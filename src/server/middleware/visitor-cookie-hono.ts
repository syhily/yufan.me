import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { resolveVisitorCookie } from '@/server/analytics/visitor-cookie'

const EXEMPT_PATH_PREFIXES = ['/__manifest', '/assets/', '/build/', '/api/']

function isExempt(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const visitorCookieMiddleware = createMiddleware<Env>(async (c, next) => {
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
