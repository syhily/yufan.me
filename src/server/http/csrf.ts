import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { clearCsrfCookie, validateRequestCsrf } from '@/server/auth/csrf'

import type { Env } from './context'

/**
 * CSRF guard for mutation routes.
 *
 * Token source order (first non-empty wins):
 *   1. `X-CSRF-Token` request header (preferred — ts-rest client
 *      attaches it from `<meta name="csrf-token">`).
 *   2. `csrf` field in the JSON body or in `parseBody()` form data
 *      (legacy fallback for `<form>` posts and pre-migration callers).
 *
 * Reading the body must not collide with the adapter's own body
 * parse. Hono caches `c.req.json()` per request, and we deliberately
 * pull the fallback body off a cloned `Request` so a multipart upload
 * (which Hono does NOT cache) is not consumed here.
 *
 * On failure: clears the CSRF cookie and throws 403. GET/HEAD are
 * always exempt (the public reads have no side effects).
 */
export const csrfGuard = createMiddleware<Env>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    return next()
  }

  let token = c.req.header('x-csrf-token') ?? undefined
  if (!token) {
    const contentType = c.req.header('content-type') ?? ''
    if (contentType.startsWith('application/json')) {
      try {
        const cloned = c.req.raw.clone()
        const body = (await cloned.json().catch(() => undefined)) as { csrf?: string } | undefined
        token = body?.csrf
      } catch {
        token = undefined
      }
    } else if (contentType.startsWith('application/x-www-form-urlencoded')) {
      try {
        const cloned = c.req.raw.clone()
        const text = await cloned.text()
        const params = new URLSearchParams(text)
        const fromForm = params.get('csrf')
        token = fromForm ?? undefined
      } catch {
        token = undefined
      }
    }
    // multipart/form-data deliberately skipped: parsing the form here
    // would race with the adapter's own `formData()` consumer. Callers
    // posting multipart MUST send `X-CSRF-Token` in the headers.
  }

  const [ok] = await validateRequestCsrf(c.req.raw, token)
  if (!ok) {
    c.header('Set-Cookie', await clearCsrfCookie(), { append: true })
    throw new HTTPException(403, { message: '页面安全令牌已失效，请刷新后重试。' })
  }

  await next()
})
