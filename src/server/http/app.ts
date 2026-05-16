import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { Env } from './context'
import type { HandlerContext } from './orpc-base'

import { apiRouter } from './api-router'
import { csrfGuard } from './middlewares/csrf'

// ─── oRPC + Hono perimeter ──────────────────────────────
//
// Single mount point for the whole API. `RPCHandler` consumes the
// composed `apiRouter` and answers every request whose path matches
// `/rpc/*`. The Hono wrapper here is responsible for three things:
//
//   1. `bodyLimit` — same 10 MB ceiling as before.
//   2. `csrfGuard` — must run **before** the RPCHandler so it can
//      validate the body without racing the handler's own parse.
//      The guard short-circuits GET / HEAD requests itself.
//   3. Context bridging — `c.var.{session,viewer,clientAddress}` is
//      populated by the perimeter middleware in `src/server.ts`;
//      `responseHeaders` is a fresh `Headers` object that procedures
//      can append to (Set-Cookie etc.) and we merge onto the final
//      Response after the handler resolves.
//
// The permission matrix is no longer an `app.ts` block — each leaf's
// guard is encoded in which base procedure (`publicProc / authedProc /
// adminProc / authorProc` in `orpc-base.ts`) the controller built it
// from. Audit surface: `grep -rn "adminProc\|authorProc"
// src/server/http/controllers/`.

const handler = new RPCHandler(apiRouter)

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  app.use(
    bodyLimit({
      maxSize: 10 * 1024 * 1024, // 10 MB
      onError: (c) => c.json({ error: { message: '请求体过大' } }, 413),
    }),
  )

  // CSRF must precede the handler (the RPCHandler will consume the
  // body once and the guard needs to read it via `request.clone()`).
  app.use('/rpc/*', csrfGuard)

  app.use('/rpc/*', async (c, next) => {
    const responseHeaders = new Headers()
    const context: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
      responseHeaders,
    }
    const result = await handler.handle(c.req.raw, { prefix: '/rpc', context })
    if (!result.matched) {
      await next()
      return
    }
    // Merge per-procedure response headers (Set-Cookie etc.) onto the
    // RPC response before handing it back to Hono. `Headers` has no
    // `size`; we iterate once to detect any-set and again to merge,
    // both via `forEach` which is the only standards-defined surface.
    let extraHeaders = false
    responseHeaders.forEach(() => {
      extraHeaders = true
    })
    if (extraHeaders) {
      const merged = new Headers(result.response.headers)
      responseHeaders.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          merged.append(key, value)
        } else {
          merged.set(key, value)
        }
      })
      return new Response(result.response.body, { status: result.response.status, headers: merged })
    }
    return result.response
  })

  return app
}
