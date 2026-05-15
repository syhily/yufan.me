import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { clearCsrfCookie, validateRequestCsrf } from '@/server/session'

import type { Env } from './context'

// CSRF guard for mutation routes. Mount on individual contracts where
// cross-site request forgery is a concern (comment submission, login, install).
// GET/HEAD requests are exempt — only POST/PATCH/DELETE/PUT are checked.
export const csrfGuard = createMiddleware<Env>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    return next()
  }

  const ct = c.req.header('content-type') ?? ''
  let body: Record<string, unknown> = {}
  try {
    if (ct.startsWith('application/json')) {
      body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    } else {
      body = (await c.req.parseBody().catch(() => ({}))) as Record<string, string>
    }
  } catch {
    // body not available
  }

  const token = (body as { csrf?: string })?.csrf
  const [ok] = await validateRequestCsrf(c.req.raw, token)
  if (!ok) {
    c.header('Set-Cookie', await clearCsrfCookie(), { append: true })
    throw new HTTPException(403, { message: '页面安全令牌已失效，请刷新后重试。' })
  }

  await next()
})
