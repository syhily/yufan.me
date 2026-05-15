import type { RouterClient } from '@orpc/server'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

import type { ApiRouter } from '@/server/http/api-router'

/**
 * Typed oRPC client. Every procedure under `apiRouter` is available
 * as a strongly-typed async function — input/output types flow from
 * the server-side `ApiRouter` type definition.
 *
 *   const { user } = await orpc.admin.users.get({ id: '42' })
 *   await orpc.admin.users.mute({ id: '42', muted: true })
 *
 * Errors thrown by the server are normalized client-side as
 * `ORPCError` instances. The `unwrap()` helper in `./unwrap.ts`
 * translates those to the existing `ApiError` class so UI consumers
 * keep working unchanged across the migration.
 *
 * CSRF: the server's `csrfGuard` middleware enforces CSRF on every
 * non-GET request. The csrf cookie is `HttpOnly`, so JS can't read
 * it directly — we inject the matching token as the
 * `X-CSRF-Token` header pulled from a server-rendered
 * `<meta name="csrf-token">` tag. Page-level loaders (admin
 * layout, post / page detail) issue or reuse the cookie and render
 * the meta tag in the same response, so any mutation kicked off
 * from that page arrives at the API with a valid token.
 */
export function readCsrfMeta(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
  return meta?.content || undefined
}

const link = new RPCLink({
  url: '/rpc',
  headers: () => {
    const token = readCsrfMeta()
    return token ? { 'x-csrf-token': token } : {}
  },
})

export const orpc: RouterClient<ApiRouter> = createORPCClient(link)

// Back-compat alias so existing call sites that still import `api`
// continue to type-check during the codemod sweep. After the
// codemod lands the alias can be removed.
export const api = orpc
