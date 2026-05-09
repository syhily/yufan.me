import { useCallback, useEffect, useRef, useState } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'

// Local-Storage backed draft persistence for the Page editor. The
// goal is "no edit ever lost" — even if the network is down, the tab
// crashes, or the user closes the browser — by mirroring every body
// snapshot into LS keyed on the page's revision token.
//
// **Key shape** `cms-page-draft:<pageId>:<clientRevisionToken>`
//
// We bind to the **revision token** rather than the page id alone so
// adopting a remote revision (post-conflict resolve) starts a clean
// LS slot — the previous slot is left intact for the conflict diff
// view to diff against, and the trim helper deletes it once the
// resolution is confirmed.
//
// **Versioning** every payload carries `version: 1`. A future schema
// change bumps the version and forces the loader to drop the old
// slot, treating the LS draft as absent.
//
// **Cross-tab sync.** Two channels:
//
//   - `storage` event — fires when *another* tab writes a value
//     under the same origin's localStorage. Reliable everywhere
//     localStorage works.
//   - `BroadcastChannel('cms-page-draft')` — modern, post-message
//     style channel. Used for richer events (e.g. signalling that a
//     draft was cleared from another tab) without piggy-backing on
//     localStorage. Falls back gracefully when the API isn't
//     available (Safari < 15.4).

const STORAGE_VERSION = 1
const STORAGE_KEY_PREFIX = 'cms-page-draft:'
const BROADCAST_NAME = 'cms-page-draft'

interface BroadcastMessage {
  /** Event kind. `cleared` is the only one the hook acts on today. */
  kind: 'cleared'
  /** Storage key that was cleared. */
  key: string
}

interface StoredDraft {
  version: number
  pageId: string
  clientRevisionToken: string
  body: PortableTextBody
  /** ms-since-epoch of the last save. Used by the conflict resolver UI. */
  savedAt: number
}

export interface UsePageLocalDraftOptions {
  pageId: string | null
  clientRevisionToken: string | null
  body: PortableTextBody
  /**
   * When `true` the hook is inert — it neither reads nor writes LS.
   * Set to `true` while the editor is in `create` mode and there's
   * no `pageId` yet.
   */
  disabled?: boolean
}

export interface UsePageLocalDraftResult {
  /**
   * The draft loaded from LS at mount time, or null when no slot
   * exists, the slot is corrupt, or the body matches the current
   * server-side revision (in which case the LS slot is still alive,
   * just irrelevant for the conflict resolver).
   */
  loadedDraft: StoredDraft | null
  /** Drop the LS slot for the current `(pageId, revToken)` pair. */
  clearDraft: () => void
}

export function usePageLocalDraft({
  pageId,
  clientRevisionToken,
  body,
  disabled = false,
}: UsePageLocalDraftOptions): UsePageLocalDraftResult {
  // The "loaded draft" is established once at mount per
  // `(pageId, revToken)` pair so a save (which writes a fresh slot)
  // doesn't immediately re-show as a "found older draft" prompt.
  const [loadedDraft, setLoadedDraft] = useState<StoredDraft | null>(null)
  const lastReadKeyRef = useRef<string | null>(null)

  const key =
    !disabled && pageId !== null && clientRevisionToken !== null
      ? `${STORAGE_KEY_PREFIX}${pageId}:${clientRevisionToken}`
      : null

  // Load on mount and whenever the key changes (i.e. opening a
  // different page or accepting a new revision).
  useEffect(() => {
    if (key === null) {
      setLoadedDraft(null)
      lastReadKeyRef.current = null
      return
    }
    if (lastReadKeyRef.current === key) {
      return
    }
    lastReadKeyRef.current = key
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) {
        setLoadedDraft(null)
        return
      }
      const parsed = JSON.parse(raw) as Partial<StoredDraft>
      if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.body)) {
        window.localStorage.removeItem(key)
        setLoadedDraft(null)
        return
      }
      setLoadedDraft(parsed as StoredDraft)
    } catch {
      // Corrupt slot — wipe it so the editor doesn't keep
      // re-loading a broken payload.
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Best-effort; ignore secondary failures.
      }
      setLoadedDraft(null)
    }
  }, [key])

  // Mirror every body change into LS. Throttled is unnecessary —
  // localStorage writes are synchronous but cheap, and the autosave
  // hook upstream already debounces edits.
  useEffect(() => {
    if (key === null || pageId === null || clientRevisionToken === null) {
      return
    }
    const payload: StoredDraft = {
      version: STORAGE_VERSION,
      pageId,
      clientRevisionToken,
      body,
      savedAt: Date.now(),
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // Quota or disabled storage — silently ignore. The user still
      // has the in-memory editor state and the network autosave.
    }
  }, [key, pageId, clientRevisionToken, body])

  // Cross-tab sync. We listen on two channels:
  //
  //   - `storage` events from `localStorage`.
  //   - A shared `BroadcastChannel` named `cms-page-draft` so a
  //     `clearDraft()` call in one tab also resets `loadedDraft` in
  //     other tabs that have the same key open.
  //
  // The hook only acts on the very narrow case "draft for *this*
  // key was cleared / reset elsewhere". Cross-tab body merging is
  // out of scope — the conflict resolver handles divergence.
  useEffect(() => {
    if (key === null) {
      return
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== key) {
        return
      }
      if (event.newValue === null) {
        setLoadedDraft(null)
        return
      }
      // Another tab just wrote a fresh draft. We deliberately do NOT
      // update the editor body here — the user may be editing in
      // *this* tab and a silent body swap would feel like data loss.
      // The conflict resolver picks this up on the next mount.
    }
    window.addEventListener('storage', onStorage)
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(BROADCAST_NAME)
      bc.addEventListener('message', (event: MessageEvent<BroadcastMessage>) => {
        if (event.data?.kind === 'cleared' && event.data.key === key) {
          setLoadedDraft(null)
        }
      })
    } catch {
      // BroadcastChannel unavailable (older Safari) — `storage`
      // alone is enough for the cleared case.
    }
    return () => {
      window.removeEventListener('storage', onStorage)
      bc?.close()
    }
  }, [key])

  const clearDraft = useCallback(() => {
    if (key === null) {
      return
    }
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Ignore.
    }
    setLoadedDraft(null)
    // Best-effort broadcast to peer tabs. Failures (channel closed
    // by browser, BroadcastChannel unsupported) are non-fatal.
    try {
      const bc = new BroadcastChannel(BROADCAST_NAME)
      const msg: BroadcastMessage = { kind: 'cleared', key }
      bc.postMessage(msg)
      bc.close()
    } catch {
      // Ignore.
    }
  }, [key])

  return { loadedDraft, clearDraft }
}

export type { StoredDraft }
