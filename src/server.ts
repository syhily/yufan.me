import { compress } from 'hono/compress'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import type { Env } from '@/server/http/context'

import { requestContext, sessionContext } from '@/server/domains/auth/context'
import { scheduleNextBackup } from '@/server/domains/backup/scheduler'
import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { wrapFetchWithLeakedResponseHandler } from '@/server/http/leaked-response'
import { honoInstallGateMiddleware } from '@/server/http/middlewares/install-gate'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/middlewares/session'
import { trailingSlashNormaliser } from '@/server/http/middlewares/trailing-slash'
import { honoVisitorCookieMiddleware } from '@/server/http/middlewares/visitor-cookie'
import { honoWpDecoyMiddleware } from '@/server/http/middlewares/wp-decoy'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { analyticsEventsRouter } from '@/server/http/resources/analytics-events'
import { backupDownloadRouter } from '@/server/http/resources/backup-download'
import { backupUploadRouter } from '@/server/http/resources/backup-upload'
import { feedRouter } from '@/server/http/resources/feed'
import { imagesRouter } from '@/server/http/resources/images'
import { redirectsRouter } from '@/server/http/resources/redirects'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { getLogger } from '@/server/infra/logger'
import { buildOpenApiDocsHtml } from '@/server/render/openapi-docs'

const requestLog = getLogger('http.request')

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

    // ─── Stale-chunk guard ────────────────────────────────
    // react-router-hono-server registers serveStatic for
    // /assets/* BEFORE configure().  When a stale tab requests a
    // JS/CSS chunk from a previous deploy that no longer exists,
    // serveStatic calls next() and the request would fall through
    // to React Router's SSR catch-all, which returns HTML.  The
    // browser then throws a SyntaxError (not a ChunkLoadError),
    // so the client's useChunkErrorRecovery never fires.
    //
    // This handler sits AFTER serveStatic but BEFORE React Router.
    // If the asset exists, serveStatic returns it and this is
    // never reached.  If the asset is missing, we return 404 so
    // the browser's dynamic import() surfaces a real fetch
    // failure that is recognised by isChunkLoadError().
    app.all('/assets/*', (c) => c.body(null, 404))

    // ─── Public resource routes ───────────────────────────
    app.route('/', analyticsEventsRouter)
    app.route('/', feedRouter)
    app.route('/', imagesRouter)
    app.route('/', sitemapRouter)
    app.route('/', redirectsRouter)

    // ─── Admin backup resource routes ─────────────────────
    app.route('/', backupDownloadRouter)
    app.route('/', backupUploadRouter)

    // ─── Dev-only API docs ────────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
      app.get('/openapi.json', async (c) => c.json(await buildOpenApiDocument()))
      app.get('/docs', (c) => c.html(buildOpenApiDocsHtml()))
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

wrapFetchWithLeakedResponseHandler(server)

// Start backup scheduler after server is configured
scheduleNextBackup()

export default server
