import { useEffect } from 'react'

import { isChunkLoadError } from '@/shared/chunk-error'

// Recover from "the JS chunk this tab needs no longer exists on the
// server" -- the failure mode that hits any browser tab still running
// a previous deploy of the site when the user navigates client-side
// or mounts a `React.lazy()` component.
//
// Modelled on Next.js's reactive recovery path
// (`nav-failure-handler.ts` in the app router, `router.ts` ->
// `handleHardNavigation` in the pages router): listen for the two
// channels through which a failed dynamic `import()` surfaces in the
// browser -- an `unhandledrejection` event (the dominant path) and a
// `window.error` event (e.g. script tag preload failure) -- and on a
// match force a full page reload to pick up the new chunk graph.
//
// Project contract -- call this hook ONCE at the top of the app
// (`src/root.tsx`'s `App`). Mirrors the single-install contract on
// `useIosNoZoomOnFocus`: two listeners would race on the same
// recovery decision and could reload twice. See `AGENTS.md`.
export function useChunkErrorRecovery(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const onError = (event: ErrorEvent) => {
      const payload = event.error ?? event.message
      if (!isChunkLoadError(payload)) {
        return
      }
      event.preventDefault()
      triggerReload()
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) {
        return
      }
      event.preventDefault()
      triggerReload()
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])
}

// Loop guard. If the freshly-deployed bundle ALSO throws a chunk
// error on first load (broken deploy, CDN serving an inconsistent
// snapshot), a naive `location.reload()` would put the tab in an
// infinite reload loop. Record the last reload attempt in
// sessionStorage and refuse to retry within `RELOAD_COOLDOWN_MS`; the
// second time around the error surfaces through the normal
// `ErrorBoundary` so the user at least sees what's wrong.
const RELOAD_GUARD_KEY = 'chunk-error-reload-attempted-at'
const RELOAD_COOLDOWN_MS = 10_000

export function triggerChunkReload(): void {
  if (typeof window === 'undefined') {
    return
  }
  let storage: Storage | null = null
  try {
    storage = window.sessionStorage
  } catch {
    storage = null
  }

  if (storage) {
    const previous = storage.getItem(RELOAD_GUARD_KEY)
    if (previous !== null) {
      const previousMs = Number.parseInt(previous, 10)
      if (Number.isFinite(previousMs) && Date.now() - previousMs < RELOAD_COOLDOWN_MS) {
        return
      }
    }
    try {
      storage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    } catch {
      // ignore -- proceed without the guard rather than block recovery.
    }
  }

  window.location.reload()
}

function triggerReload() {
  triggerChunkReload()
}

// Companion hook for React error boundaries -- a chunk error thrown
// during render (e.g. a `React.lazy()` component whose chunk 404s)
// lands in the nearest boundary instead of as an unhandled rejection,
// so the window-level listeners above never see it.
export function useReloadOnChunkError(error: unknown): void {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      triggerChunkReload()
    }
  }, [error])
}
