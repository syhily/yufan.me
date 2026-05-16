import { createMiddleware } from 'hono/factory'

import { resolveVisitorCookie } from '@/server/analytics/visitor-cookie'

import type { Env } from '../context'

const EXEMPT_PATH_PREFIXES = ['/__manifest', '/assets/', '/build/', '/api/', '/feed', '/sitemap.xml', '/images/']

function isExempt(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const honoVisitorCookieMiddleware = createMiddleware<Env>(async (c, next) => {
  const url = new URL(c.req.url)
  if (isExempt(url.pathname)) {
    return next()
  }
  const { setCookie } = resolveVisitorCookie(c.req.raw)
  await next()
  if (setCookie) {
    c.header('Set-Cookie', setCookie, { append: true })
  }
})
