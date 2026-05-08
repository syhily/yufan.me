import type { ApiActionDescriptor } from '@/client/api/fetcher'
import type { ApiEnvelope } from '@/shared/api-envelope'

// Promise-returning counterpart to `useApiFetcher`. The hook is built
// on top of `react-router`'s `useFetcher`, which fires-and-forgets and
// surfaces the result through a deferred render. That works great for
// click handlers but autosave needs to await each request to keep its
// in-flight bookkeeping honest. This helper bypasses the React Router
// fetcher infrastructure and just hits the underlying resource route
// directly.
//
// **Envelope contract**: every API action returns
// `{ data?: O } | { error: { message: string } }`. Callers branch on
// the discriminator. Network-level failures (4xx/5xx where the body
// isn't JSON, or `fetch` itself throws) are normalised into the
// envelope's `error` shape so callers see a single, predictable
// rejection contract regardless of the failure mode.
export async function submitApiAction<I, O>(action: ApiActionDescriptor, payload: I): Promise<ApiEnvelope<O>> {
  try {
    const response = await fetch(action.path, {
      method: action.method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    if (text === '') {
      // Some endpoints (rare) reply with a 204 / empty body. Treat
      // it as a successful envelope with no `data` slot — callers
      // discriminate on `data` vs `error`, so the absent `data`
      // works as expected.
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
