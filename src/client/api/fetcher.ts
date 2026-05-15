import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'

export type ApiActionMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

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
  // Latest unwrapped success payload.
  data: O | undefined
  // Latest error envelope.
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

// ---------------------------------------------------------------------------
// Path parameter substitution
// ---------------------------------------------------------------------------

const UNHANDLED = Symbol('unhandled')

/**
 * Extract path parameters (`:name`) from a payload and substitute them into
 * the URL path. Remaining keys become the body/query object.
 *
 * Example:
 *   extractPathParams('/api/items/:id', { id: '123', name: 'foo' })
 *   // => { path: '/api/items/123', remainder: { name: 'foo' } }
 */
function extractPathParams(
  path: string,
  payload: Record<string, unknown>,
): { path: string; remainder: Record<string, unknown> } {
  let resultPath = path
  const remainder: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const placeholder = `:${key}`
    if (resultPath.includes(placeholder)) {
      resultPath = resultPath.replace(placeholder, encodeURIComponent(String(value)))
    } else {
      remainder[key] = value
    }
  }
  return { path: resultPath, remainder }
}

// ---------------------------------------------------------------------------
// Response normalisation (supports both legacy envelope and direct body)
// ---------------------------------------------------------------------------

interface LegacyEnvelope<T> {
  data?: T
  error?: { message: string }
}

function isLegacyEnvelope<T>(value: unknown): value is LegacyEnvelope<T> {
  return value !== null && typeof value === 'object' && ('data' in value || 'error' in value)
}

function normaliseResponse<T>(value: unknown): { data?: T; error?: { message: string } } {
  if (isLegacyEnvelope<T>(value)) {
    return { data: value.data, error: value.error }
  }
  // Direct body (ts-rest / Hono style)
  return { data: value as T }
}

// ---------------------------------------------------------------------------
// useFetcherResult
// ---------------------------------------------------------------------------

export function useFetcherResult<O>(fetcher: FetcherResultSource<unknown>, options?: UseFetcherResultOptions<O>): void {
  const latest = useRef(options)
  latest.current = options

  const lastHandled = useRef<unknown>(UNHANDLED)
  useEffect(() => {
    const raw = fetcher.data
    if (fetcher.state !== 'idle' || raw === undefined) {
      return
    }
    if (raw === lastHandled.current) {
      return
    }
    lastHandled.current = raw

    const { action, onSuccess, onError } = latest.current ?? {}
    const { data, error } = normaliseResponse<O>(raw)

    if (error) {
      if (onError) {
        onError(error, action)
      } else if (action) {
        console.error(`[api] ${action.method} ${action.path} failed`, error)
      } else {
        console.error('[api] request failed', error)
      }
      return
    }

    onSuccess?.(data as O)
  }, [fetcher.state, fetcher.data])
}

// ---------------------------------------------------------------------------
// useApiFetcher
// ---------------------------------------------------------------------------

export function useApiFetcher<I, O>(
  action: ApiActionDescriptor,
  options?: UseApiFetcherOptions<O>,
): UseApiFetcherResult<I, O> {
  const fetcher = useFetcher<unknown>()

  const latest = useRef({ fetcher, options })
  latest.current = { fetcher, options }

  useFetcherResult<O>(fetcher, {
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

  const submitAsync = useCallback(
    (payload: I): Promise<void> => {
      if (payload instanceof FormData) {
        return latest.current.fetcher.submit(payload as never, {
          method: action.method,
          encType: 'multipart/form-data',
          action: action.path,
        })
      }
      const { path, remainder } = extractPathParams(action.path, (payload ?? {}) as Record<string, unknown>)
      const body = Object.keys(remainder).length > 0 ? remainder : undefined
      return latest.current.fetcher.submit(body as never, {
        method: action.method,
        encType: 'application/json',
        action: path,
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
      const { path, remainder } = extractPathParams(action.path, (query ?? {}) as Record<string, unknown>)
      const search = new URLSearchParams()
      for (const [k, v] of Object.entries(remainder)) {
        if (v === null || v === undefined) {
          continue
        }
        search.set(k, String(v))
      }
      const queryString = search.toString()
      void latest.current.fetcher.load(queryString ? `${path}?${queryString}` : path)
    },
    [action.path],
  )

  const { data, error } = normaliseResponse<O>(fetcher.data)

  return {
    submit,
    submitAsync,
    load,
    data,
    error,
    isPending: fetcher.state !== 'idle',
    isSubmitting: fetcher.state === 'submitting',
  }
}
