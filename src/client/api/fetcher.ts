import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'

import type { ApiActionMethod } from '@/shared/api-actions'
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
  // method + path are reused so callers don't repeat them.
  submit: (payload: I) => void
  // GET load. Optional query params are URL-encoded; otherwise we just hit
  // the action's bare path.
  load: (query?: Record<string, ApiQueryValue>) => void
  // Latest unwrapped success payload (mirrors `fetcher.data?.data`).
  data: O | undefined
  // Latest error envelope (mirrors `fetcher.data?.error`).
  error: { message: string } | undefined
  // True while the underlying fetcher is loading or submitting.
  isPending: boolean
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
    if (data.data !== undefined) {
      onSuccess?.(data.data)
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
  const submit = useCallback(
    (payload: I) => {
      void latest.current.fetcher.submit(payload as never, {
        method: action.method,
        encType: 'application/json',
        action: action.path,
      })
    },
    [action.method, action.path],
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

  return {
    submit,
    load,
    data: fetcher.data?.data,
    error: fetcher.data?.error,
    isPending: fetcher.state !== 'idle',
  }
}
