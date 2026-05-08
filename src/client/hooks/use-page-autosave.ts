import { useCallback, useEffect, useRef } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'

// Autosave engine for the Page editor. The contract is intentionally
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

export interface UsePageAutosaveOptions {
  /** PT body that the editor currently shows. Polled by reference. */
  body: PortableTextBody
  /** When false, the hook is fully inert (no timers, no listeners). */
  enabled: boolean
  /**
   * Called with the latest body whenever the autosave fires. The
   * hook's own bookkeeping waits for the returned promise to settle
   * before counting the snapshot as persisted, so a slow flush won't
   * be re-triggered before the previous one completes.
   */
  flush: (body: PortableTextBody) => Promise<void>
  /** Debounce window in ms. Default: 5_000. */
  debounceMs?: number
  /** Hard cap in ms. Default: 60_000. */
  hardCapMs?: number
}

export function usePageAutosave({
  body,
  enabled,
  flush,
  debounceMs = 5_000,
  hardCapMs = 60_000,
}: UsePageAutosaveOptions): { forceFlush: () => Promise<void> } {
  // Refs keep the closures stable across renders so we don't
  // re-attach the visibility/pagehide listeners every keystroke.
  const flushRef = useRef(flush)
  flushRef.current = flush
  const bodyRef = useRef(body)
  bodyRef.current = body
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const lastPersistedRef = useRef<PortableTextBody | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Centralised flusher. Skips when disabled, when no change since
  // the last persist, or when a flush is already in flight (in which
  // case we wait for that one and then re-evaluate).
  const doFlush = useCallback(async (): Promise<void> => {
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
    const promise = flushRef.current(snapshot)
    inFlightRef.current = promise
    try {
      await promise
      lastPersistedRef.current = snapshot
    } finally {
      if (inFlightRef.current === promise) {
        inFlightRef.current = null
      }
    }
  }, [])

  // Fire the debounce + hard-cap timers each time `body` changes.
  // The timers are reset together so a series of edits within
  // `hardCapMs` still yields exactly one flush at the cap, with the
  // newest body.
  useEffect(() => {
    if (!enabled) {
      return
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

  // Cancel any pending hard-cap timer when the hook unmounts so a
  // stale closure can't fire after the editor is gone.
  useEffect(() => {
    return () => {
      if (hardCapTimerRef.current !== null) {
        clearTimeout(hardCapTimerRef.current)
        hardCapTimerRef.current = null
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
