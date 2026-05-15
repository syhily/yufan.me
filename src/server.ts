import { swaggerUI } from '@hono/swagger-ui'
import { requestId } from 'hono/request-id'
import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import { requestContext, sessionContext } from '@/server/auth/context'
import { createApiApp } from '@/server/http/app'
import { honoInstallGateMiddleware } from '@/server/http/install-gate'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { feedRouter } from '@/server/http/resources/feed'
import { imagesRouter } from '@/server/http/resources/images'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/session'
import { honoVisitorCookieMiddleware } from '@/server/http/visitor-cookie'

export default await createHonoServer({
  configure(app) {
    app.use(requestId())
    app.use(honoSessionMiddleware)
    app.use(honoInstallGateMiddleware)
    app.use(honoVisitorCookieMiddleware)

    // ─── API (ts-rest contracts) ────────────────────────
    app.route('/', createApiApp())

    // ─── Public resource routes ───────────────────────────
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
    const { session, request } = buildRouteContexts(c as any)
    const context = new RouterContextProvider()
    context.set(sessionContext, session)
    context.set(requestContext, request)
    return context
  },
})
