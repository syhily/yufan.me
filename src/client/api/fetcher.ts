import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'

import type { ApiActionMethod } from '@/client/api/api-descriptors'
import type { ApiEnvelope } from '@/shared/api-envelope'

export type { ApiEnvelope }

// Descriptor produced by `defineApiAction` in `@/shared/api-actions`. Passing
// the descriptor (instead of `path` + `method` separately) keeps every island
// pointing at the same canonical declaration of where the endpoint lives.
export interface ApiActionDescriptor {
  path: string
  method: ApiActionMethod
}

export interface UseApiFetcherOptions<O> {
  /**
   * Fired exactly once per response when the envelope carries `{ data }`.
   *
   * **Caller transparency**: the most recent `onSuccess` reference wins.
   * The hook stores `options` in a `useRef` and reads through it inside
   * a single result-draining effect, so re-creating the callback inline
   * (`{ onSuccess: (data) => …}` on every render) does NOT trigger a
   * re-fire of the callback. Use the freshest closure freely without
   * `useCallback` ceremony.
   */
  onSuccess?: (data: O) => void
  /**
   * Fired exactly once per response when the envelope carries `{ error }`.
   * When omitted, the default behavior is to `console.error` so a missed
   * refactor doesn't silently swallow an API failure.
   *
   * Same caller-transparency contract as `onSuccess` — re-creating the
   * callback inline is fine.
   */
  onError?: (error: { message: string }, action: ApiActionDescriptor) => void
}

interface FetcherResultSource<T> {
  state: string
  data?: T
}

export interface UseFetcherResultOptions<O> {
  /**
   * Fired exactly once per response when the envelope carries `{ data }`.
   *
   * Same caller-transparency contract as `useApiFetcher`'s
   * `onSuccess` — see that interface for the rationale. The hook
   * latches the latest `options` into a ref so an inline arrow
   * function does NOT cause the result effect to re-fire.
   */
  onSuccess?: (data: O) => void
  /**
   * Fired exactly once per response when the envelope carries `{ error }`.
   * Same caller-transparency contract as `onSuccess`.
   */
  onError?: (error: { message: string }, action: ApiActionDescriptor | undefined) => void
  /** Optional descriptor used only for diagnostics. */
  action?: ApiActionDescriptor
}

export interface UseApiFetcherResult<I, O> {
  // POST/PATCH/DELETE submit. `payload` is JSON-encoded; the descriptor's
  // method + path are reused so callers don't repeat them. Fire-and-forget
  // — the returned Promise from the underlying fetcher is intentionally
  // dropped so the call site does not need to mark it as `void`. Use
  // `submitAsync` when the caller needs to await the round trip.
  submit: (payload: I) => void
  // POST/PATCH/DELETE submit that returns the underlying `fetcher.submit`
  // promise. The promise resolves once React Router has completed both the
  // submission and its trailing revalidation pass, at which point the
  // `useFetcherResult` effect has already drained `fetcher.data` and fired
  // `onSuccess`. Use this from inside `startTransition` when an optimistic
  // UI needs the transition to stay pending throughout the round trip.
  submitAsync: (payload: I) => Promise<void>
  // GET load. Optional query params are URL-encoded; otherwise we just hit
  // the action's bare path.
  load: (query?: Record<string, ApiQueryValue>) => void
  // Latest unwrapped success payload (mirrors `fetcher.data?.data`).
  data: O | undefined
  // Latest error envelope (mirrors `fetcher.data?.error`).
  error: { message: string } | undefined
  // True while the underlying fetcher is loading or submitting.
  // This includes the trailing React Router revalidation phase
  // that follows every POST (`submitting → loading → idle`), so
  // it is the right gate for "wait for the server's view of the
  // world to settle before re-running side effects" (e.g.
  // autosave coordination).
  isPending: boolean
  // True ONLY while the network round-trip is in flight
  // (`fetcher.state === 'submitting'`). Flips back to `false` the
  // moment the server response is committed, before the trailing
  // revalidation `loading` phase. Use this as the gate for "block
  // user input while the user's save is travelling" — typical UI
  // disable / spinner cases — so the editor surface unfreezes as
  // soon as the request settles instead of waiting out the
  // revalidation cycle.
  isSubmitting: boolean
}

export type ApiQueryValue = string | number | boolean | null | undefined

export function useFetcherResult<O>(
  fetcher: FetcherResultSource<ApiEnvelope<O>>,
  options?: UseFetcherResultOptions<O>,
): void {
  const latest = useRef(options)
  latest.current = options

  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    const data = fetcher.data
    if (fetcher.state !== 'idle' || !data) {
      return
    }
    if (data === lastHandled.current) {
      return
    }
    lastHandled.current = data

    const { action, onSuccess, onError } = latest.current ?? {}
    if (data.error) {
      if (onError) {
        onError(data.error, action)
      } else if (action) {
        console.error(`[api] ${action.method} ${action.path} failed`, data.error)
      } else {
        console.error('[api] request failed', data.error)
      }
      return
    }
    // Support both old envelope { data: T } and new Hono direct { ...T } response formats.
    if (data.data !== undefined) {
      onSuccess?.(data.data)
    } else {
      // New Hono API returns data directly without { data: T } wrapper.
      // Treat the entire response body as the success payload.
      onSuccess?.(data as unknown as O)
    }
  }, [fetcher.state, fetcher.data])
}

// Minimal wrapper around `useFetcher<ApiEnvelope<O>>`. Two responsibilities:
// 1. Stable `submit(payload)` / `load(query)` callbacks that JSON-encode
//    or URL-encode the call site's typed payload exactly once per descriptor.
// 2. A *single* `useEffect` that drains `fetcher.data` once per response and
//    fans the unwrapped envelope out to `onSuccess` / `onError`.
//
// Forms that don't need a result callback (e.g. `<fetcher.Form>` posting a
// reply with the server-rendered tree updating from loader data) should use
// the underlying `useFetcher` directly. This hook is for islands that still
// want the typed JSON channel.
export function useApiFetcher<I, O>(
  action: ApiActionDescriptor,
  options?: UseApiFetcherOptions<O>,
): UseApiFetcherResult<I, O> {
  const fetcher = useFetcher<ApiEnvelope<O>>()

  // Pin the latest options + fetcher in a single ref so the result-draining
  // effect can stay keyed on `fetcher.state` + `fetcher.data` only — re-running
  // on identity changes of inline `options.onSuccess` would refire the
  // callback every render in a parent that rebuilds the options object inline.
  const latest = useRef({ fetcher, options })
  latest.current = { fetcher, options }

  useFetcherResult(fetcher, {
    action,
    onSuccess: (data) => latest.current.options?.onSuccess?.(data),
    onError: (error) => {
      const onError = latest.current.options?.onError
      if (onError) {
        onError(error, action)
      } else {
        console.error(`[api] ${action.method} ${action.path} failed`, error)
      }
    },
  })

  // `useCallback` keeps `submit` / `load` referentially stable across
  // renders, so consumers can list them in their own `useEffect` deps
  // without triggering loops. `fetcher.submit` / `fetcher.load` themselves
  // are not stable across renders, but they always read the latest closure
  // through the `latest` ref above.
  const submitAsync = useCallback(
    (payload: I): Promise<void> => {
      return latest.current.fetcher.submit(payload as never, {
        method: action.method,
        encType: 'application/json',
        action: action.path,
      })
    },
    [action.method, action.path],
  )

  const submit = useCallback(
    (payload: I): void => {
      void submitAsync(payload)
    },
    [submitAsync],
  )

  const load = useCallback(
    (query?: Record<string, ApiQueryValue>) => {
      if (!query) {
        void latest.current.fetcher.load(action.path)
        return
      }
      const search = new URLSearchParams()
      for (const [k, v] of Object.entries(query)) {
        if (v === null || v === undefined) {
          continue
        }
        search.set(k, String(v))
      }
      const queryString = search.toString()
      void latest.current.fetcher.load(queryString ? `${action.path}?${queryString}` : action.path)
    },
    [action.path],
  )

  // Support both old envelope { data: T } and new Hono direct { ...T } format.
  const raw = fetcher.data as Record<string, unknown> | undefined
  const unwrapped = raw?.data !== undefined ? raw.data : raw?.error !== undefined ? undefined : raw

  return {
    submit,
    submitAsync,
    load,
    data: unwrapped as O | undefined,
    error: fetcher.data?.error,
    isPending: fetcher.state !== 'idle',
    isSubmitting: fetcher.state === 'submitting',
  }
}

// Promise-returning counterpart to `useApiFetcher` for imperative save flows.
export interface SubmitApiActionOptions {
  signal?: AbortSignal
}

export async function submitApiAction<I, O>(
  action: ApiActionDescriptor,
  payload: I,
  options: SubmitApiActionOptions = {},
): Promise<ApiEnvelope<O>> {
  try {
    const response = await fetch(action.path, {
      method: action.method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
    const text = await response.text()
    if (text === '') {
      if (response.ok) {
        return { data: undefined as unknown as O }
      }
      return { error: { message: response.statusText || 'request_failed' } }
    }
    let parsed: ApiEnvelope<O>
    try {
      parsed = JSON.parse(text) as ApiEnvelope<O>
    } catch {
      return { error: { message: text.slice(0, 256) } }
    }
    return parsed
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { error: { message } }
  }
}

// ── Admin mutation wrapper ──────────────────────────────────────────────────────

export interface UseAdminMutationOptions<O> {
  /** Toast message on success. Pass a function to derive from the returned data. Omit / pass false to suppress. */
  successMessage?: string | ((data: O) => string) | false
  /** Custom prefix for default error toast (default: "操作失败"). */
  errorMessage?: string | ((error: { message: string }) => string)
  /** Called once per successful response (after toast). */
  onSuccess?: (data: O) => void
  /** Called once per error envelope (after toast). Return `true` to suppress the default error toast. */
  onError?: (error: { message: string }) => boolean | void
}

export function useAdminMutation<I, O>(
  action: ApiActionDescriptor,
  options?: UseAdminMutationOptions<O>,
): UseApiFetcherResult<I, O> {
  const fetcher = useApiFetcher<I, O>(action, {
    onSuccess: useCallback(
      (data: O) => {
        const msg = options?.successMessage
        if (msg !== false && msg !== undefined) {
          toast.success(typeof msg === 'function' ? msg(data) : msg)
        }
        options?.onSuccess?.(data)
      },
      [options],
    ),
    onError: useCallback(
      (error: { message: string }) => {
        const suppress = options?.onError?.(error) === true
        if (suppress) {
          return
        }
        const msg = options?.errorMessage
        if (typeof msg === 'function') {
          toast.error(msg(error))
        } else if (typeof msg === 'string') {
          toast.error(msg, { description: error.message })
        } else {
          toast.error('操作失败', { description: error.message })
        }
      },
      [options],
    ),
  })

  return fetcher
}
