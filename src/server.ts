import { swaggerUI } from '@hono/swagger-ui'
import { requestId } from 'hono/request-id'
import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import type { Env } from '@/server/http/context'

import { requestContext, sessionContext } from '@/server/auth/context'
import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { honoInstallGateMiddleware } from '@/server/http/install-gate'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { analyticsEventsRouter } from '@/server/http/resources/analytics-events'
import { feedRouter } from '@/server/http/resources/feed'
import { imagesRouter } from '@/server/http/resources/images'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/session'
import { honoVisitorCookieMiddleware } from '@/server/http/visitor-cookie'
import { honoWpDecoyMiddleware } from '@/server/http/wp-decoy'

export default await createHonoServer<Env>({
  configure(app) {
    app.onError(onErrorHandler)
    app.use(requestId())
    app.use(honoWpDecoyMiddleware)
    app.use(honoSessionMiddleware)
    app.use(honoInstallGateMiddleware)
    app.use(honoVisitorCookieMiddleware)

    // Legacy API redirect — /api/actions/* was the old RPC prefix.
    // GET requests are forwarded with their query string; mutations return
    // 410 because body parameters cannot survive a cross-style redirect.
    app.all('/api/actions/*', (c) => {
      if (c.req.method === 'GET' || c.req.method === 'HEAD') {
        const url = new URL(c.req.url)
        const legacyPath = url.pathname.replace(/^\/api\/actions\//, '/api/')
        const kebabPath = legacyPath.replace(/\/([a-z]+)([A-Z])/g, '/$1-$2').toLowerCase()
        url.pathname = kebabPath
        return c.redirect(url.toString(), 301)
      }
      return c.json({ error: { message: '旧版 API 已停用，请改用 REST 契约端点。' } }, 410)
    })

    // ─── API (ts-rest contracts) ────────────────────────
    app.route('/', createApiApp())

    // ─── Public resource routes ───────────────────────────
    app.route('/', analyticsEventsRouter)
    app.route('/', feedRouter)
    app.route('/', imagesRouter)
    app.route('/', sitemapRouter)

    // Legacy RR redirects now served by Hono
    app.get('/tags', (c) => {
      c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
      return c.redirect('/', 301)
    })
    app.get('/search', (c) => {
      const query = c.req.query('q')?.trim() ?? ''
      c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
      return c.redirect(query ? `/search/${encodeURIComponent(query)}` : '/', 301)
    })

    if (process.env.NODE_ENV !== 'production') {
      app.get('/openapi.json', (c) => c.json(buildOpenApiDocument()))
      app.get('/docs', swaggerUI({ url: '/openapi.json' }))
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
