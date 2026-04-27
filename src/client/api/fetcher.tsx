import { type ComponentProps, useCallback, useEffect, useMemo, useRef } from 'react'
import { type FetcherWithComponents, useFetcher } from 'react-router'

import type { ApiActionMethod } from '@/client/api/actions'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { dispatchApiError } from '@/client/api/error-bus'

export type { ApiEnvelope }

// Descriptor produced by `defineApiAction` in `@/shared/api-actions`. Passing
// the descriptor (instead of `path` + `method` separately) keeps every island
// pointing at the same canonical declaration of where the endpoint lives.
export interface ApiActionDescriptor {
  path: string
  method: ApiActionMethod
}

export interface UseApiActionOptions<O> {
  // Fired exactly once per response when the envelope carries `{ data }`.
  // Applies to both JSON (`submit`/`load`) and form (`<Form>`) channels.
  onSuccess?: (data: O) => void
  // Fired exactly once per response when the envelope carries `{ error }`.
  // When omitted, the default behavior is to `console.error` so a missed
  // refactor doesn't silently swallow an API failure.
  onError?: (error: { message: string }, action: ApiActionDescriptor) => void
}

// Slim wrapper around React Router's `<fetcher.Form>` that prefills `method`
// and `action` from the descriptor so call sites only configure layout
// (`className`, `id`, refs) and inputs.
type ApiFormElementProps = Omit<ComponentProps<'form'>, 'method' | 'action' | 'encType'>

export interface UseApiActionResult<I, O> {
  // POST/PATCH/DELETE submit. `payload` is JSON-encoded; the descriptor's
  // method + path are reused so callers don't repeat them. The returned
  // promise resolves once the fetcher finishes its round-trip back to
  // `idle`, so call sites that need to await completion (e.g. React 19
  // `<form action={asyncFn}>` / `useFormStatus` flows) can `await` it.
  submit: (payload: I) => Promise<void>
  // GET load. Optional query params are URL-encoded; otherwise we just hit
  // the action's bare path. Like `submit`, returns a promise that settles on
  // the fetcher's transition back to `idle`.
  load: (query?: Record<string, string | number>) => Promise<void>
  // `<Form>` channel. Renders a `<fetcher.Form>` with `method` + `action`
  // pre-bound to the descriptor; the same `onSuccess` / `onError` handlers
  // fire when the response envelope drains. Omit this prop when the call
  // site uses `submit`/`load` instead.
  Form: (props: ApiFormElementProps) => React.JSX.Element
  // Latest unwrapped success payload (mirrors `fetcher.data?.data`).
  data: O | undefined
  // Latest error envelope (mirrors `fetcher.data?.error`).
  error: { message: string } | undefined
  // True while the underlying fetcher is loading or submitting.
  isPending: boolean
  // Raw fetcher escape hatch for advanced cases (e.g. `formRef` + DOM reset
  // after submit). Prefer `Form`/`submit`/`load` whenever possible.
  fetcher: FetcherWithComponents<ApiEnvelope<O>>
}

// Single shared hook for talking to a JSON-envelope resource route. Two
// responsibilities:
// 1. Stable `submit(payload)` / `load(query)` callbacks that JSON-encode
//    or URL-encode the call site's typed payload exactly once per descriptor.
// 2. A *single* `useEffect` that drains `fetcher.data` once per response and
//    fans the unwrapped envelope out to `onSuccess` / `onError`.
//
// The hook also exposes a typed `<Form>` so call sites that submit through
// `<fetcher.Form>` (e.g. comment reply with a regular form-encoded POST) get
// the same `onSuccess` / `onError` ergonomics without re-implementing the
// envelope-draining effect.
export function useApiAction<I, O>(
  action: ApiActionDescriptor,
  options?: UseApiActionOptions<O>,
): UseApiActionResult<I, O> {
  const fetcher = useFetcher<ApiEnvelope<O>>()

  // Pin the latest options + fetcher in a single ref so the result-draining
  // effect can stay keyed on `fetcher.state` + `fetcher.data` only — re-running
  // on identity changes of inline `options.onSuccess` would refire the
  // callback every render in a parent that rebuilds the options object inline.
  const latest = useRef({ fetcher, options })
  latest.current = { fetcher, options }

  // Pending callers awaiting a `submit()` / `load()` round-trip. Resolved
  // by the round-trip drain effect below the next time the fetcher returns
  // to `idle` carrying response data.
  const pendingResolversRef = useRef<Array<() => void>>([])
  const drainPending = useCallback(() => {
    const resolvers = pendingResolversRef.current
    if (resolvers.length === 0) {
      return
    }
    pendingResolversRef.current = []
    for (const resolve of resolvers) {
      resolve()
    }
  }, [])

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
    const { onSuccess, onError } = latest.current.options ?? {}
    if (data.error) {
      // Drain the envelope failure: site-specific handlers (`onError`) win,
      // otherwise the global toast surface (registered via `error-bus`)
      // shows it. The bus falls back to `console.error` when no surface
      // is mounted (SSR, unit tests rendering an island in isolation), so
      // refactors don't silently swallow API errors.
      if (onError) {
        onError(data.error, action)
      } else {
        dispatchApiError({ message: data.error.message, method: action.method, path: action.path })
      }
    } else if (data.data !== undefined) {
      onSuccess?.(data.data)
    }
    drainPending()
  }, [fetcher.state, fetcher.data, action, drainPending])

  // `useCallback` keeps `submit` / `load` referentially stable across
  // renders, so consumers can list them in their own `useEffect` deps
  // without triggering loops. `fetcher.submit` / `fetcher.load` themselves
  // are not stable across renders, but they always read the latest closure
  // through the `latest` ref above.
  const submit = useCallback(
    (payload: I) => {
      const promise = new Promise<void>((resolve) => {
        pendingResolversRef.current.push(resolve)
      })
      void latest.current.fetcher.submit(payload as never, {
        method: action.method,
        encType: 'application/json',
        action: action.path,
      })
      return promise
    },
    [action.method, action.path],
  )

  const load = useCallback(
    (query?: Record<string, string | number>) => {
      const promise = new Promise<void>((resolve) => {
        pendingResolversRef.current.push(resolve)
      })
      if (!query) {
        void latest.current.fetcher.load(action.path)
      } else {
        const search = new URLSearchParams()
        for (const [k, v] of Object.entries(query)) {
          search.set(k, String(v))
        }
        void latest.current.fetcher.load(`${action.path}?${search.toString()}`)
      }
      return promise
    },
    [action.path],
  )

  // `Form` keeps a stable identity across renders (otherwise React would
  // remount the underlying `<fetcher.Form>` and its inputs every render).
  // The closure is keyed on `fetcher.Form` plus the descriptor; `fetcher.Form`
  // is what changes between fetcher revisions, so memoising on its identity
  // gives us the best of both worlds.
  const FormComponent = fetcher.Form
  const Form = useMemo(() => {
    function ApiActionForm(props: ApiFormElementProps) {
      return <FormComponent method={action.method} action={action.path} {...props} />
    }
    ApiActionForm.displayName = `ApiAction<${action.method}>(${action.path})`
    return ApiActionForm
  }, [FormComponent, action.method, action.path])

  return {
    submit,
    load,
    Form,
    data: fetcher.data?.data,
    error: fetcher.data?.error,
    isPending: fetcher.state !== 'idle',
    fetcher,
  }
}
