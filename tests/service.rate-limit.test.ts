import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Tiny in-memory Redis double that supports just the two commands the
// rate-limit module actually pipelines: `INCR` and `EXPIRE … NX`. We
// don't model TTL ticks (the production module never reads the TTL
// back), so the assertion surface stays narrow on purpose.
interface PipelineRecord {
  cmd: 'incr' | 'expire'
  args: unknown[]
}

interface MockRedis {
  counts: Map<string, number>
  ttls: Map<string, number>
  pipeline: ReturnType<typeof vi.fn>
  /** Flat list of all pipeline commands seen across the test (newest last). */
  log: PipelineRecord[]
}

function createRedis(): MockRedis {
  const counts = new Map<string, number>()
  const ttls = new Map<string, number>()
  const log: PipelineRecord[] = []

  const pipeline = vi.fn(() => {
    const queue: PipelineRecord[] = []
    const builder = {
      incr(key: string) {
        queue.push({ cmd: 'incr', args: [key] })
        return builder
      },
      expire(key: string, seconds: number, mode?: string) {
        queue.push({ cmd: 'expire', args: [key, seconds, mode] })
        return builder
      },
      async exec() {
        const results: [Error | null, unknown][] = []
        for (const entry of queue) {
          log.push(entry)
          if (entry.cmd === 'incr') {
            const [key] = entry.args as [string]
            const next = (counts.get(key) ?? 0) + 1
            counts.set(key, next)
            results.push([null, next])
            continue
          }
          // EXPIRE — `NX` only sets the TTL when the key has no TTL.
          // We don't simulate TTL expiry, so this is just bookkeeping.
          const [key, seconds] = entry.args as [string, number, string?]
          if (!ttls.has(key)) {
            ttls.set(key, seconds)
          }
          results.push([null, 1])
        }
        return results
      },
    }
    return builder
  })

  return { counts, ttls, pipeline, log }
}

const redis = createRedis()

vi.mock('@/server/cache/storage', () => ({
  redisInstance: () => redis,
  storage: {},
}))

const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')
const { TEST_BLOG_SETTINGS_BUNDLE } = await import('./_helpers/blog-settings')
const { tryRateLimit, tryCommentPostRateLimit, tryCommentPostRateLimitByEmail, tryLikeIncreaseRateLimit } =
  await import('@/server/rate-limit')

beforeEach(() => {
  redis.counts.clear()
  redis.ttls.clear()
  redis.log.length = 0
  redis.pipeline.mockClear()
  setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
})

describe('server/rate-limit — config-driven thresholds', () => {
  it('uses the active settings snapshot for windowSeconds + maxAttempts', async () => {
    setBlogSettingsBundleForTests({
      ...TEST_BLOG_SETTINGS_BUNDLE,
      rateLimit: {
        ...TEST_BLOG_SETTINGS_BUNDLE.rateLimit!,
        likeIncreaseIp: { windowSeconds: 120, maxAttempts: 2 },
      },
    })

    const first = await tryLikeIncreaseRateLimit('1.2.3.4')
    const second = await tryLikeIncreaseRateLimit('1.2.3.4')
    const third = await tryLikeIncreaseRateLimit('1.2.3.4')

    expect(first).toEqual({ count: 1, exceeded: false })
    expect(second).toEqual({ count: 2, exceeded: false })
    // 3rd hit > maxAttempts(2) — surface this as `exceeded: true`.
    expect(third).toEqual({ count: 3, exceeded: true })

    // First hit armed the EXPIRE NX with the configured window; later
    // hits still emit the EXPIRE pipeline step but our mock no-ops it.
    const expires = redis.log.filter((entry) => entry.cmd === 'expire')
    expect(expires.length).toBeGreaterThan(0)
    expect(expires[0]?.args).toEqual([expect.stringMatching(/^rate-limit:like-increase:/), 120, 'NX'])
  })

  it('hot-reloads when the admin saves a new policy mid-process', async () => {
    setBlogSettingsBundleForTests({
      ...TEST_BLOG_SETTINGS_BUNDLE,
      rateLimit: {
        ...TEST_BLOG_SETTINGS_BUNDLE.rateLimit!,
        signInIp: { windowSeconds: 60, maxAttempts: 3 },
      },
    })
    expect((await tryRateLimit('5.5.5.5')).exceeded).toBe(false)
    expect((await tryRateLimit('5.5.5.5')).exceeded).toBe(false)
    expect((await tryRateLimit('5.5.5.5')).exceeded).toBe(false)
    // 4th call — still inside the original cap of 3, so `exceeded: true`.
    expect((await tryRateLimit('5.5.5.5')).exceeded).toBe(true)

    // Admin tightens the cap to 1; the very next call sees the new
    // policy because the module reads the snapshot synchronously.
    setBlogSettingsBundleForTests({
      ...TEST_BLOG_SETTINGS_BUNDLE,
      rateLimit: {
        ...TEST_BLOG_SETTINGS_BUNDLE.rateLimit!,
        signInIp: { windowSeconds: 60, maxAttempts: 1 },
      },
    })
    // Counter for `5.5.5.5` is already at 4 from the previous calls,
    // so any further attempt is over the new cap of 1.
    expect((await tryRateLimit('5.5.5.5')).exceeded).toBe(true)
    // A previously-unseen IP starts at 1 → still > new cap of 1? No,
    // the post-increment counter is exactly 1 which equals
    // maxAttempts; only `count > maxAttempts` is treated as exceeded.
    expect((await tryRateLimit('9.9.9.9')).exceeded).toBe(false)
    expect((await tryRateLimit('9.9.9.9')).exceeded).toBe(true)
  })

  it('falls back to the historical defaults when the snapshot is null (pre-install)', async () => {
    setBlogSettingsBundleForTests(null)

    // Default sign-in cap is 5 — first 5 hits stay under, the 6th trips.
    for (let i = 0; i < 5; i += 1) {
      expect((await tryRateLimit('7.7.7.7')).exceeded).toBe(false)
    }
    expect((await tryRateLimit('7.7.7.7')).exceeded).toBe(true)
  })

  it('isolates buckets so the four surfaces never share a counter', async () => {
    await tryRateLimit('11.11.11.11')
    await tryCommentPostRateLimit('11.11.11.11')
    await tryCommentPostRateLimitByEmail('alice@example.com')
    await tryLikeIncreaseRateLimit('11.11.11.11')

    const namespaces = [...redis.counts.keys()].map((key) => key.split(':').slice(0, 2).join(':'))
    expect(new Set(namespaces)).toEqual(
      new Set(['rate-limit:signin', 'rate-limit:comment-post', 'rate-limit:comment-email', 'rate-limit:like-increase']),
    )
    // Email keys must store the hash, not the raw address. The string
    // 'alice@example.com' should never appear verbatim in any key.
    for (const key of redis.counts.keys()) {
      expect(key.includes('alice@example.com')).toBe(false)
    }
  })
})
