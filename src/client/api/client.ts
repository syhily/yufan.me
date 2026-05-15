import { initClient, tsRestFetchApi } from '@ts-rest/core'

import { apiContract } from '@/shared/contracts'

/**
 * Typed ts-rest client. Every endpoint described in `apiContract` is
 * available as a strongly-typed async function.
 *
 *   const { body } = await api.admin.users.list({ query: { offset: 0 } })
 *
 * For mutation endpoints use `unwrap()` to turn non-2xx responses into
 * thrown `ApiError`:
 *
 *   await unwrap(api.admin.users.mute({ params: { id }, body: { muted: true } }))
 *
 * CSRF: the perimeter `csrfGuard` middleware enforces CSRF on every
 * non-GET request (`server/http/csrf.ts`). The csrf cookie is
 * `HttpOnly`, so JS can't read it directly — we inject the matching
 * token via an `<X-CSRF-Token>` header pulled from a server-rendered
 * `<meta name="csrf-token">` tag. Page-level loaders (admin layout,
 * post / page detail) issue or reuse the cookie and render the meta
 * tag in the same response, so any mutation kicked off from that page
 * arrives at the API with a valid token.
 */
function readCsrfMeta(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
  return meta?.content || undefined
}

export const api = initClient(apiContract, {
  baseUrl: '/api',
  baseHeaders: {
    'Content-Type': 'application/json',
  },
  api: async (args) => {
    if (args.method !== 'GET' && args.method !== 'HEAD') {
      const token = readCsrfMeta()
      if (token) {
        args.headers = { ...args.headers, 'x-csrf-token': token }
      }
    }
    return tsRestFetchApi(args)
  },
})
