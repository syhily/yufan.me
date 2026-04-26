import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'

import type { ApiActionMethod } from '@/client/api/actions'
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
  // Fired exactly once per response when the envelope carries `{ data }`.
  onSuccess?: (data: O) => void
  // Fired exactly once per response when the envelope carries `{ error }`.
  // When omitted, the default behavior is to `console.error` so a missed
  // refactor doesn't silently swallow an API failure.
  onError?: (error: { message: string }, action: ApiActionDescriptor) => void
}

export interface UseApiFetcherResult<I, O> {
  // POST/PATCH/DELETE submit. `payload` is JSON-encoded; the descriptor's
  // method + path are reused so callers don't repeat them.
  submit: (payload: I) => void
  // GET load. Optional query params are URL-encoded; otherwise we just hit
  // the action's bare path.
  load: (query?: Record<string, string | number>) => void
  // Latest unwrapped success payload (mirrors `fetcher.data?.data`).
  data: O | undefined
  // Latest error envelope (mirrors `fetcher.data?.error`).
  error: { message: string } | undefined
  // True while the underlying fetcher is loading or submitting.
  isPending: boolean
}

// Wraps `useFetcher<ApiEnvelope<O>>` with the boilerplate every island used
// to repeat: cache the action descriptor, JSON-encode the payload, dedupe
// the `useEffect` on the most recent response, fan out success/error
// callbacks. See `phase2-use-api-fetcher` in the refactor plan for the
// motivation.
export function useApiFetcher<I, O>(
  action: ApiActionDescriptor,
  options?: UseApiFetcherOptions<O>,
): UseApiFetcherResult<I, O> {
  const fetcher = useFetcher<ApiEnvelope<O>>()
  const lastHandled = useRef<unknown>(null)

  // Pin the latest callbacks so the effect can stay keyed on
  // `fetcher.state` + `fetcher.data` only — re-running on identity changes
  // of `options.onSuccess` / `options.onError` would refire the success
  // callback every render in a parent that rebuilds the options object
  // inline.
  const onSuccessRef = useRef(options?.onSuccess)
  const onErrorRef = useRef(options?.onError)
  useEffect(() => {
    onSuccessRef.current = options?.onSuccess
    onErrorRef.current = options?.onError
  })

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data === lastHandled.current) return
    lastHandled.current = fetcher.data
    if (fetcher.data.error) {
      const handler = onErrorRef.current
      if (handler) handler(fetcher.data.error, action)
      else console.error(`[api] ${action.method} ${action.path} failed`, fetcher.data.error)
      return
    }
    if (fetcher.data.data !== undefined) {
      onSuccessRef.current?.(fetcher.data.data)
    }
  }, [fetcher.state, fetcher.data, action])

  // `useCallback` keeps `submit` / `load` referentially stable across
  // renders, so consumers can list them in their own `useEffect` deps
  // without triggering loops. `fetcher.submit` / `fetcher.load` themselves
  // are not stable across renders, but they always read the latest
  // closure inside the callbacks below.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const submit = useCallback(
    (payload: I) => {
      void fetcherRef.current.submit(payload as never, {
        method: action.method,
        encType: 'application/json',
        action: action.path,
      })
    },
    [action.method, action.path],
  )

  const load = useCallback(
    (query?: Record<string, string | number>) => {
      if (!query) {
        void fetcherRef.current.load(action.path)
        return
      }
      const search = new URLSearchParams()
      for (const [k, v] of Object.entries(query)) {
        search.set(k, String(v))
      }
      void fetcherRef.current.load(`${action.path}?${search.toString()}`)
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
