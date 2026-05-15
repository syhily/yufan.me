import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { RouterContextProvider, createRequestHandler } from 'react-router'

import type { Env } from '@/server/http/context'

import { requestContext, sessionContext } from '@/server/auth/context'
import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { analyticsEventsRouter } from '@/server/http/resources/analytics-events'
import { feedRouter } from '@/server/http/resources/feed'
import { redirectRouter } from '@/server/http/resources/redirects'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { clientAddressMiddleware } from '@/server/middleware/client-address'
import { installGateMiddleware } from '@/server/middleware/install-gate-hono'
import { sessionMiddleware } from '@/server/middleware/session-hono'
import { visitorCookieMiddleware } from '@/server/middleware/visitor-cookie-hono'
import { wpDecoyMiddleware } from '@/server/middleware/wp-decoy'

export function createApp(): Hono<Env> {
  const app = new Hono<Env>()

  app.onError(onErrorHandler)

  // Global middleware — order matters.
  app.use('*', requestId())
  app.use('*', clientAddressMiddleware)
  app.use('*', wpDecoyMiddleware)
  app.use('*', sessionMiddleware)
  app.use('*', installGateMiddleware)
  app.use('*', visitorCookieMiddleware)

  // OpenAPI docs (dev only).
  if (import.meta.env.DEV) {
    app.get('/openapi.json', (c) => c.json(buildOpenApiDocument()))
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  }

  // API (ts-rest contracts).
  app.route('/', createApiApp())
  // Resource routes (non-JSON: feeds, sitemap, SSE, redirects).
  app.route('/', feedRouter)
  app.route('/', sitemapRouter)
  app.route('/', analyticsEventsRouter)
  app.route('/', redirectRouter)

  // Catch-all → React Router SSR.
  app.all('*', async (c) => {
    const build = await import('virtual:react-router/server-build')
    const handler = createRequestHandler(build, import.meta.env.PROD ? 'production' : 'development')

    const ctx = new RouterContextProvider()
    const user = c.var.session.get('user')
    ctx.set(sessionContext, { session: c.var.session, user, role: user?.role ?? null })
    ctx.set(requestContext, { clientAddress: c.var.clientAddress, url: new URL(c.req.url) })

    return handler(c.req.raw, ctx)
  })

  return app
}

const app = createApp()

if (import.meta.env.PROD && !import.meta.env.VITEST) {
  serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 })
}

export default app
