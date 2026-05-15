import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { serveStatic } from 'hono/serve-static'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'

import type { Env } from '@/server/http/context'

import { createApiApp } from '@/server/http/app'
import { onErrorHandler } from '@/server/http/errors'
import { buildOpenApiDocument } from '@/server/http/openapi'
import { analyticsEventsRouter } from '@/server/http/resources/analytics-events'
import { feedRouter } from '@/server/http/resources/feed'
import { imagesRouter } from '@/server/http/resources/images'
import { searchRouter } from '@/server/http/resources/search'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { tagsRouter } from '@/server/http/resources/tags'
import { clientAddressMiddleware } from '@/server/middleware/client-address'
import { installGateMiddleware } from '@/server/middleware/install-gate-hono'
import { requestLoggerMiddleware } from '@/server/middleware/request-logger'
import { sessionMiddleware } from '@/server/middleware/session-hono'
import { visitorCookieMiddleware } from '@/server/middleware/visitor-cookie-hono'
import { wpDecoyMiddleware } from '@/server/middleware/wp-decoy'

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
])

export function createApp(): Hono<Env> {
  const app = new Hono<Env>()

  app.onError(onErrorHandler)

  // Static files — serve before install gate so public assets (logos, favicon,
  // manifest, etc.) are accessible even when the site hasn't been installed yet.
  const staticRoot = import.meta.env.PROD ? './build/client' : './public'
  app.use(
    '*',
    serveStatic({
      root: staticRoot,
      getContent: async (filePath, c) => {
        if (!existsSync(filePath)) {
          return null
        }
        try {
          const s = await stat(filePath)
          if (!s.isFile()) {
            return null
          }
        } catch {
          return null
        }
        const ext = extname(filePath).toLowerCase()
        const mime = MIME.get(ext) ?? 'application/octet-stream'
        const content = await readFile(filePath)
        c.header('Content-Type', mime)
        return c.body(content)
      },
    }),
  )

  // Global middleware — order matters.
  app.use('*', requestId())
  app.use('*', clientAddressMiddleware)
  app.use('*', wpDecoyMiddleware)
  app.use('*', sessionMiddleware)
  app.use('*', installGateMiddleware)
  app.use('*', visitorCookieMiddleware)
  app.use('*', requestLoggerMiddleware)

  // OpenAPI docs (dev only).
  if (import.meta.env.DEV) {
    app.get('/openapi.json', (c) => c.json(buildOpenApiDocument()))
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  }

  // Health check.
  app.get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }))

  // API (ts-rest contracts).
  app.route('/', createApiApp())
  // 308 redirects for old API URLs → new RESTful URLs (preserves method).
  app.all('/api/actions/*', (c) => {
    const oldPath = new URL(c.req.url).pathname
    const newPath = oldPath.replace('/api/actions/', '/api/')
    return c.redirect(newPath, 308)
  })

  // Resource routes (non-JSON: feeds, sitemap, SSE, images, redirects).
  app.route('/', feedRouter)
  app.route('/', sitemapRouter)
  app.route('/', imagesRouter)
  app.route('/', analyticsEventsRouter)
  app.route('/', tagsRouter)
  app.route('/', searchRouter)

  // Catch-all → React Router SSR (dev mode: @hono/vite-dev-server uses our app
  // directly; prod mode: react-router-hono-server wraps our app and its own
  // reactRouterApp runs after our routes).
  app.all('*', async (c) => {
    const { RouterContextProvider, createRequestHandler } = await import('react-router')
    const build = await import('virtual:react-router/server-build')
    const handler = createRequestHandler(build, import.meta.env.PROD ? 'production' : 'development')

    const { sessionContext, requestContext } = await import('@/server/auth/context')
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
