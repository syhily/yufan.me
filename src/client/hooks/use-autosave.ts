import { useCallback, useEffect, useRef } from 'react'

import type { PortableTextBody } from '@/shared/pt/schema'

// Autosave engine for the Page / Post editor. The contract is intentionally
// minimal — caller supplies the live body + a `flush` function that
// performs the network round-trip — so the hook is straightforward to
// test in isolation.
//
// **Schedule**
//
//   - **Debounce window:** 5 s. The clock resets every time `body`
//     changes, so a steady stream of typing flushes once you stop.
//   - **Hard cap:** 60 s. Even if the user keeps typing, we force a
//     flush at most once per minute so the server-side draft never
//     drifts more than a minute behind reality.
//   - **Force flush triggers:** `visibilitychange` (the tab going
//     hidden) and `pagehide`. Browsers grant ~150 ms before tearing
//     down the tab; both events are reliable enough for `fetch()` to
//     ride. We do NOT use `beforeunload` because Chrome ignores
//     promises returned from it.
//
// **Inert states**
//
//   - The hook stays inert while `enabled === false` (e.g. a save is
//     already in flight, or the page is in `create` mode and there's
//     no `id` yet).
//   - It also skips flushes when `body` is referentially equal to the
//     last persisted snapshot — covers the common
//     "remount with the same value" case after a server save.

/**
 * Status surface for the autosave loop. The hook calls
 * `onStatusChange` whenever the loop transitions; the editor shell
 * can render a small indicator without re-implementing the logic.
 */
export type AutosaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'retrying'; attempt: number; nextAttemptAt: number; message: string }

export interface UseAutosaveOptions {
  /** PT body that the editor currently shows. Polled by reference. */
  body: PortableTextBody
  /** When false, the hook is fully inert (no timers, no listeners). */
  enabled: boolean
  /**
   * Called with the latest body whenever the autosave fires. The
   * hook's own bookkeeping waits for the returned promise to settle
   * before counting the snapshot as persisted, so a slow flush won't
   * be re-triggered before the previous one completes.
   *
   * Throw / reject to signal failure. The hook then retries at
   * 1s/3s/9s backoff (configurable via `retryDelaysMs`); once retries
   * are exhausted the snapshot is treated as "kept locally" — the LS
   * draft is still good and the user can rerun the flow manually.
   */
  flush: (body: PortableTextBody) => Promise<void>
  /** Debounce window in ms. Default: 5_000. */
  debounceMs?: number
  /** Hard cap in ms. Default: 60_000. */
  hardCapMs?: number
  /**
   * Backoff schedule for failed flushes. Default: `[1_000, 3_000,
   * 9_000]` (three retries). After the last retry fails, the loop
   * stops touching the network until the body changes again.
   */
  retryDelaysMs?: number[]
  /** Optional status surface. Called on every loop transition. */
  onStatusChange?: (status: AutosaveStatus) => void
}

const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 9_000]

export function useAutosave({
  body,
  enabled,
  flush,
  debounceMs = 5_000,
  hardCapMs = 60_000,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  onStatusChange,
}: UseAutosaveOptions): { forceFlush: () => Promise<void> } {
  // Refs keep the closures stable across renders so we don't
  // re-attach the visibility/pagehide listeners every keystroke.
  const flushRef = useRef(flush)
  flushRef.current = flush
  const bodyRef = useRef(body)
  bodyRef.current = body
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onStatusRef = useRef(onStatusChange)
  onStatusRef.current = onStatusChange
  const retryDelaysRef = useRef(retryDelaysMs)
  retryDelaysRef.current = retryDelaysMs
  const lastPersistedRef = useRef<PortableTextBody | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const emit = useCallback((status: AutosaveStatus) => {
    onStatusRef.current?.(status)
  }, [])

  // Centralised flusher. Skips when disabled, when no change since
  // the last persist, or when a flush is already in flight (in which
  // case we wait for that one and then re-evaluate). On failure it
  // schedules a retry from the backoff schedule, advancing through
  // the schedule on each subsequent failure for the same snapshot.
  const doFlush = useCallback(
    async (attempt = 0): Promise<void> => {
      if (!enabledRef.current) {
        return
      }
      if (lastPersistedRef.current === bodyRef.current) {
        return
      }
      if (inFlightRef.current !== null) {
        try {
          await inFlightRef.current
        } catch {
          // Previous flush failed; fall through to retry below.
        }
      }
      const snapshot = bodyRef.current
      emit({ kind: 'saving' })
      const promise = flushRef.current(snapshot)
      inFlightRef.current = promise
      try {
        await promise
        lastPersistedRef.current = snapshot
        emit({ kind: 'saved', at: Date.now() })
      } catch (cause) {
        const delays = retryDelaysRef.current
        if (attempt >= delays.length) {
          // Out of retries — leave the body in `lastPersistedRef`'s
          // older state so the next body change kicks the loop back
          // off. The LS hook still mirrors the in-memory body, so
          // the user's work isn't lost; it just hasn't reached the
          // server.
          const message = cause instanceof Error ? cause.message : '保存失败，本地已保留。'
          emit({
            kind: 'retrying',
            attempt: delays.length,
            nextAttemptAt: Date.now(),
            message: `本地已保留：${message}`,
          })
          return
        }
        const delay = delays[attempt] ?? delays[delays.length - 1] ?? 1_000
        const message = cause instanceof Error ? cause.message : '保存失败'
        emit({
          kind: 'retrying',
          attempt: attempt + 1,
          nextAttemptAt: Date.now() + delay,
          message,
        })
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current)
        }
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          void doFlush(attempt + 1)
        }, delay)
      } finally {
        if (inFlightRef.current === promise) {
          inFlightRef.current = null
        }
      }
    },
    [emit],
  )

  // Fire the debounce + hard-cap timers each time `body` changes.
  // The timers are reset together so a series of edits within
  // `hardCapMs` still yields exactly one flush at the cap, with the
  // newest body. Any pending retry is cancelled because new edits
  // mean we have a fresher snapshot worth saving from scratch.
  useEffect(() => {
    if (!enabled) {
      return
    }
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      void doFlush()
    }, debounceMs)
    if (hardCapTimerRef.current === null) {
      hardCapTimerRef.current = setTimeout(() => {
        hardCapTimerRef.current = null
        void doFlush()
      }, hardCapMs)
    }
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [body, enabled, debounceMs, hardCapMs, doFlush])

  // Force-flush on tab hide / pagehide. We use `visibilitychange`
  // (covers Mac OS Cmd-H, mobile background, tab switch) and
  // `pagehide` (covers full unload + bfcache navigation). Both fire
  // synchronously enough that a `fetch()` initiated from the
  // listener body has time to leave the browser before tear-down.
  useEffect(() => {
    if (!enabled) {
      return
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void doFlush()
      }
    }
    function onPageHide() {
      void doFlush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [enabled, doFlush])

  // Cancel any pending hard-cap and retry timers when the hook
  // unmounts so a stale closure can't fire after the editor is gone.
  useEffect(() => {
    return () => {
      if (hardCapTimerRef.current !== null) {
        clearTimeout(hardCapTimerRef.current)
        hardCapTimerRef.current = null
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  const forceFlush = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    await doFlush()
  }, [doFlush])

  return { forceFlush }
}
