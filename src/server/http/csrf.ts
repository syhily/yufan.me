import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { clearCsrfCookie, validateRequestCsrf } from '@/server/auth/csrf'

import type { Env } from './context'

/**
 * CSRF guard for mutation routes.
 *
 * Reads the token from the JSON body (`csrf` field) or form data.
 * On failure clears the CSRF cookie and throws 403.
 *
 * Mount via guards factory:
 *   `authedRoute(app, contract, impl, { middleware: [csrfGuard] })`
 */
export const csrfGuard = createMiddleware<Env>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    return next()
  }

  let token: string | undefined

  const contentType = c.req.header('content-type') ?? ''
  if (contentType.startsWith('application/json')) {
    try {
      const body = await c.req.json()
      token = body?.csrf as string | undefined
    } catch {
      token = undefined
    }
  } else if (
    contentType.startsWith('application/x-www-form-urlencoded') ||
    contentType.startsWith('multipart/form-data')
  ) {
    try {
      const body = await c.req.parseBody()
      token = body?.csrf as string | undefined
    } catch {
      token = undefined
    }
  }

  const [ok] = await validateRequestCsrf(c.req.raw, token)
  if (!ok) {
    c.header('Set-Cookie', await clearCsrfCookie(), { append: true })
    throw new HTTPException(403, { message: '页面安全令牌已失效，请刷新后重试。' })
  }

  await next()
})
