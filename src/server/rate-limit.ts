import { redisInstance } from '@/server/cache/storage'

const LIMIT_TTL = 60 * 30

export const LIMIT_THRESHOLD = 5

const limitKey = (ip: string) => `rate-limit:${ip}`

export interface RateLimitResult {
  /** Post-increment counter value for this IP within the current window. */
  count: number
  /** True once the counter strictly exceeds `LIMIT_THRESHOLD`. */
  exceeded: boolean
}

// Increment-and-check in a single round trip.
//
// Replaces the legacy `exceedLimit` (GET) + `incrLimit` (INCR+EXPIRE) pair
// that the sign-in flow ran sequentially on every attempt. The new
// contract: callers always go through `tryRateLimit` once, then branch on
// `result.exceeded` to bail with a 429. Successful and failed logins both
// bump the counter — the threshold is "attempts per 30 minutes" and the
// bookkeeping shouldn't depend on the eventual outcome of the login.
//
// The old implementation also had a read-modify-write race: two concurrent
// hits could both observe `times = 0` and both write `1`. `INCR` is atomic
// in Redis, so the post-increment counter is strictly monotonic. The
// pipelined `EXPIRE … NX` arms the TTL on the first hit only; subsequent
// hits within the window don't continually extend it (Redis 7.0+; older
// servers silently no-op the NX arg, which would extend TTL on every hit
// — still correct, just less ideal).
export async function tryRateLimit(ip: string): Promise<RateLimitResult> {
  const key = limitKey(ip)
  const redis = redisInstance()

  const pipeline = redis.pipeline()
  pipeline.incr(key)
  pipeline.expire(key, LIMIT_TTL, 'NX')
  const results = await pipeline.exec()

  const incrResult = results?.[0]
  if (!incrResult || incrResult[0]) {
    throw new Error(`tryRateLimit: failed to increment counter for ${ip}`, {
      cause: incrResult?.[0] ?? undefined,
    })
  }
  const count = Number(incrResult[1])
  return { count, exceeded: count > LIMIT_THRESHOLD }
}
