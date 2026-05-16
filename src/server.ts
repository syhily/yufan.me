import { compress } from 'hono/compress'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import type { Env } from '@/server/http/context'

import { requestContext, sessionContext } from '@/server/auth/context'
import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { honoInstallGateMiddleware } from '@/server/http/middlewares/install-gate'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/middlewares/session'
import { trailingSlashNormaliser } from '@/server/http/middlewares/trailing-slash'
import { honoVisitorCookieMiddleware } from '@/server/http/middlewares/visitor-cookie'
import { honoWpDecoyMiddleware } from '@/server/http/middlewares/wp-decoy'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { analyticsEventsRouter } from '@/server/http/resources/analytics-events'
import { feedRouter } from '@/server/http/resources/feed'
import { imagesRouter } from '@/server/http/resources/images'
import { redirectsRouter } from '@/server/http/resources/redirects'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { getLogger } from '@/server/infra/logger'

const requestLog = getLogger('http.request')
const leakedResponseLog = getLogger('http.leaked-response')

const server = await createHonoServer<Env>({
  configure(app) {
    app.onError(onErrorHandler)
    app.use(requestId())
    app.use(compress())
    app.use(secureHeaders())
    app.use(async (c, next) => {
      const start = Date.now()
      await next()
      const duration = Date.now() - start
      requestLog.info('request', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration,
        requestId: c.var.requestId,
      })
    })
    app.use(trailingSlashNormaliser)
    app.use(honoWpDecoyMiddleware)
    app.use(honoSessionMiddleware)
    app.use(honoInstallGateMiddleware)
    app.use(honoVisitorCookieMiddleware)

    // Health probes
    app.get('/health', (c) => c.json({ status: 'ok' }))
    app.get('/ready', (c) => c.json({ status: 'ok' }))

    // ─── API (oRPC at /rpc/*) ────────────────────────────
    app.route('/', createApiApp())

    // ─── Public resource routes ───────────────────────────
    app.route('/', analyticsEventsRouter)
    app.route('/', feedRouter)
    app.route('/', imagesRouter)
    app.route('/', sitemapRouter)
    app.route('/', redirectsRouter)

    // ─── Dev-only API docs ────────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
      app.get('/openapi.json', async (c) => c.json(await buildOpenApiDocument()))
      app.get('/docs', (c) =>
        c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>API Documentation</title>
  <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  <style>
    body { margin: 0; }
    elements-api { display: block; height: 100vh; }
  </style>
</head>
<body>
  <elements-api
    apiDescriptionUrl="/openapi.json"
    router="hash"
    layout="sidebar"
  />
</body>
</html>`),
      )
    }
  },
  getLoadContext(c) {
    const { session, request } = buildRouteContexts(c)
    const context = new RouterContextProvider()
    context.set(sessionContext, session)
    context.set(requestContext, request)
    return context
  },
})

// Defensive: Hono's app.onError does not catch thrown Response objects (only
// Error instances).  React Router loaders/actions throw Response/redirect()
// as control flow, and in rare edge cases (streaming deferred boundaries,
// middleware ordering bugs, or react-router-hono-server internal leakage) the
// Response can bubble past Hono's error handler and crash the dev server with
// "Unknown error: [object Response]".  Wrapping app.fetch lets us intercept
// the leaked Response, log it for diagnostics, and return it normally.
const originalFetch = server.fetch.bind(server)
server.fetch = (request, env, executionContext) => {
  try {
    const result = originalFetch(request, env, executionContext)
    if (result instanceof Promise) {
      return result.catch((e) => {
        if (e instanceof Response) {
          leakedResponseLog.warn('leaked-response', {
            url: request instanceof Request ? request.url : undefined,
            status: e.status,
            statusText: e.statusText,
          })
          return e
        }
        throw e
      })
    }
    return result
  } catch (e) {
    if (e instanceof Response) {
      leakedResponseLog.warn('leaked-response', {
        url: request instanceof Request ? request.url : undefined,
        status: e.status,
        statusText: e.statusText,
      })
      return e
    }
    throw e
  }
}

export default server
