import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { tryRateLimit } from '@/server/rate-limit'

import type { Env } from './context'

// Per-route rate limiting keyed by client IP. Reuses the existing Redis-backed
// rate limit infrastructure from `@/server/rate-limit`.
export const rateLimitByIp = () =>
  createMiddleware<Env>(async (c, next) => {
    const { exceeded } = await tryRateLimit(c.var.clientAddress)
    if (exceeded) {
      throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' })
    }
    await next()
  })
