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
 * `ORPCError` instances.
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
  // RPCLink does `new URL(baseUrl)` internally and the `URL` constructor
  // throws on relative inputs ("Invalid URL"), so we resolve `/rpc`
  // against `location.origin` lazily. Lazy because:
  //   - `client.ts` is allowed to import-transitively from SSR-side
  //     code (typing only), so we must NOT touch `window` at module
  //     load — the function is only invoked once a request actually
  //     fires, which by construction is the browser.
  //   - Storybook / Vitest may stub `location`; reading it per-call
  //     instead of once-at-construction keeps those overrides honest.
  url: () => `${globalThis.location?.origin ?? 'http://localhost'}/rpc`,
  headers: () => {
    const token = readCsrfMeta()
    return token ? { 'x-csrf-token': token } : {}
  },
})

export const orpc: RouterClient<ApiRouter> = createORPCClient(link)
