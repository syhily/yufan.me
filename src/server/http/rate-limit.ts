import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { RateLimitBucket } from '@/shared/blog-config'

import { tryKeyedRateLimit } from '@/server/rate-limit'

import type { Env } from './context'

/**
 * Rate-limit middleware factory. Uses the client IP as the discriminator.
 *
 * Example:
 *   `authedRoute(app, contract, impl, { middleware: [rateLimitByIp('invite', 5, 60000)] })`
 */
export function rateLimitByIp(key: string, maxAttempts: number, windowMs: number) {
  const bucket: RateLimitBucket = { maxAttempts, windowSeconds: Math.ceil(windowMs / 1000) }
  return createMiddleware<Env>(async (c, next) => {
    const { exceeded } = await tryKeyedRateLimit(`rate-limit:${key}:${c.var.clientAddress}`, bucket)
    if (exceeded) {
      throw new HTTPException(429, { message: '请求过于频繁，请稍后再试。' })
    }
    await next()
  })
}
