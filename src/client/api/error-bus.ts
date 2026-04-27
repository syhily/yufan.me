// Lightweight pub/sub for unhandled API errors. Lives in `client/` (not in
// the UI layer) so `useApiAction` / `useApiStream` can dispatch from
// inside their default `onError` branch without importing UI components.
//
// The actual presentation is wired up by `<ToastSurface>` from the toast
// primitive which subscribes via `setApiErrorListener`. When no listener
// is registered (e.g. server-side render, unit tests instantiated
// outside a layout) the dispatcher logs to the console so regressions
// still show up locally.

export interface ApiErrorPayload {
  /** Human-friendly Chinese message — already user-facing. */
  message: string
  /** HTTP method of the failing endpoint. */
  method?: string
  /** Path of the failing endpoint, useful for log reading. */
  path?: string
}

type Listener = (payload: ApiErrorPayload) => void

let activeListener: Listener | null = null

/**
 * Register the toast surface's error notifier. Returns an unsubscriber that
 * `<ToastSurface>` calls in its cleanup hook so a remounted surface can take
 * over without leaking the previous reference.
 */
export function setApiErrorListener(listener: Listener): () => void {
  activeListener = listener
  return () => {
    if (activeListener === listener) {
      activeListener = null
    }
  }
}

/** Used by tests to assert "no listener leaks across specs". */
export function hasApiErrorListener(): boolean {
  return activeListener !== null
}

/**
 * Fire the registered error listener (if any). Called by the default
 * `onError` branch in `useApiAction` and the transport-failure branch in
 * `useApiStream`. When no listener is mounted we fall back to
 * `console.error` so the failure is still visible during local dev or in
 * SSR scenarios where the toast surface isn't yet on the page.
 */
export function dispatchApiError(payload: ApiErrorPayload): void {
  if (activeListener) {
    activeListener(payload)
    return
  }
  const route = payload.method && payload.path ? `${payload.method} ${payload.path}` : 'unknown action'
  console.error(`[api] ${route} failed`, payload.message)
}
