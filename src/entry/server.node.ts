// Phase A1 spike: Hono entry skeleton.
//
// **Spike scope**: this file demonstrates the Hono shell shape the
// plan envisions. It is NOT yet wired into the Vite dev server or
// `react-router-serve` — the existing RR resource routes still
// serve `/api/actions/**`. Phase A2 swaps the dev server entry
// (`react-router-hono-server` or a hand-rolled Vite plugin) and
// the production launcher to this module.
//
// Right now this entry can be invoked directly via Node for
// standalone API verification:
//
//     node --experimental-vm-modules -r tsx ./src/entry/server.node.ts
//
// (or any TS runner). It does:
//   - install middleware: requestId, clientAddress placeholder,
//     session reader (production session-storage),
//   - mount `createApiApp()` (the ts-rest contract tree) at `/`,
//   - serve `/openapi.json` + Swagger UI at `/docs` in dev.
//
// The catch-all React Router SSR handoff is sketched in but
// commented out — once `react-router-hono-server` is integrated,
// uncomment + remove the `routes/api/actions/**` RR shim.

import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'

import type { Env } from '@/server/http/context'

import { getSession } from '@/server/auth/session-storage'
import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { buildOpenApiDocument } from '@/server/http/openapi'

export function createServer(): Hono<Env> {
  const app = new Hono<Env>()

  app.onError(onErrorHandler)

  // ── Global middleware (order matters) ─────────────────────────
  // 1. requestId — populated on every request, surfaced in 500
  //    responses for log correlation.
  app.use('*', requestId())

  // 2. clientAddress — for the spike we read `x-forwarded-for` or
  //    fall back to the socket address from Hono's request info.
  //    Phase A4 replaces this with the production
  //    `@/shared/request` resolver wrapped as a middleware.
  app.use('*', async (c, next) => {
    const fwd = c.req.header('x-forwarded-for')
    const ip = fwd ? (fwd.split(',')[0] ?? '').trim() : ''
    c.set('clientAddress', ip || '127.0.0.1')
    await next()
  })

  // 3. session — read the cookie session through the existing
  //    session-storage abstraction. The middleware seeds
  //    `c.var.session` for controllers; the commit step (writing
  //    the Set-Cookie back on mutation) lands in Phase A3.
  app.use('*', async (c, next) => {
    const cookie = c.req.header('cookie') ?? ''
    const session = await getSession(cookie)
    c.set('session', session)
    c.set('sessionDirty', false)
    c.set('viewer', null)
    await next()
  })

  // ── Dev-only OpenAPI docs ─────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.get('/openapi.json', (c) => c.json(buildOpenApiDocument()))
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  }

  // ── ts-rest contract surface ──────────────────────────────────
  // Mounted at `/api` so the contract files stay prefix-free
  // (see `src/shared/contracts/index.ts` for the rationale).
  app.route('/api', createApiApp())

  // ── (Phase A2) RR SSR catch-all ───────────────────────────────
  // app.all('*', async (c) => {
  //   const build = await import('virtual:react-router/server-build')
  //   const handler = createRequestHandler(build, process.env.NODE_ENV ?? 'production')
  //   const user = c.var.session.get('user')
  //   return handler(c.req.raw, {
  //     session: c.var.session,
  //     viewer: user ? { userId: user.id, role: user.role } : null,
  //     clientAddress: c.var.clientAddress,
  //   })
  // })

  return app
}

// Run standalone when executed directly. Production launcher and
// Vite dev server integration will both reach for `createServer()`
// instead of relying on this side-effect block.
if (
  process.env.HONO_STANDALONE === '1' ||
  // ESM "is-main" check
  import.meta.url === `file://${process.argv[1]}`
) {
  const app = createServer()
  const port = Number(process.env.PORT) || 3000
  serve({ fetch: app.fetch, port })
  console.log(`[hono spike] listening on http://localhost:${port}`)
}

export default createServer
