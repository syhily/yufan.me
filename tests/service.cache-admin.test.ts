import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Stub Redis with a minimal in-memory store that supports the SCAN /
// UNLINK round-trips the cache-admin service relies on. We can't reuse
// `tests/_helpers/redis.ts` directly because that helper doesn't model
// SCAN cursors or UNLINK; this file owns the smaller, purpose-built
// mock for the cache-admin contract.
interface MockRedis {
  store: Map<string, unknown>
  scan: ReturnType<typeof vi.fn>
  unlink: ReturnType<typeof vi.fn>
}

function createRedis(initial: Record<string, unknown> = {}): MockRedis {
  const store = new Map(Object.entries(initial))
  // Return everything in one SCAN call (cursor "0" → done). The
  // production code is cursor-paginated, so a single-batch response
  // exercises the loop's exit branch.
  const scan = vi.fn(async (_cursor: string, _match: string, pattern: string, _count: string, count: number) => {
    void _cursor
    void _match
    void _count
    void count
    const re = patternToRegex(pattern)
    const matched = [...store.keys()].filter((key) => re.test(key))
    return ['0', matched]
  })
  const unlink = vi.fn(async (...keys: string[]) => {
    let removed = 0
    for (const key of keys) {
      if (store.delete(key)) {
        removed += 1
      }
    }
    return removed
  })
  return { store, scan, unlink }
}

// Translate a Redis SCAN MATCH pattern (only `*` wildcard supported in
// this corner of the surface) to a JS regex.
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`)
}

// `vi.mock('@/server/cache/storage', …)` runs against the mock factory's
// return value at import time, so the redis instance shared by every
// test is created before any `await import(...)` below.
const fixture = createRedis()

vi.mock('@/server/cache/storage', () => ({
  redisInstance: () => fixture,
  storage: {},
}))

const { clearAdminCache, getAdminCacheStats } = await import('@/server/cache/admin')
const { ActionFailure } = await import('@/server/route-helpers/api-handler')
const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')
const { TEST_BLOG_SETTINGS_BUNDLE } = await import('./_helpers/blog-settings')

describe('service: cache admin', () => {
  beforeEach(() => {
    fixture.store.clear()
    fixture.unlink.mockClear()
    fixture.scan.mockClear()
    // Restore the global fixture between tests; individual cases below
    // override individual cache prefixes to exercise rename logic.
    setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
  })

  it('counts keys per bucket via SCAN', async () => {
    // The shared fixture seeds historical prefixes (`og-`, `avatar-`,
    // `calendar-`); see `tests/_helpers/blog-settings`.
    fixture.store.set('og-hello-deadbeef', new Uint8Array([1, 2]))
    fixture.store.set('og-world-cafef00d', new Uint8Array([3, 4]))
    fixture.store.set('avatar-abc', new Uint8Array([5]))
    fixture.store.set('calendar-2026-04-30', new Uint8Array([6]))
    // Out-of-bucket noise (sessions, rate-limit) — must NOT show up.
    fixture.store.set('session:xyz', 'cookie-payload')
    fixture.store.set('rate-limit:1.2.3.4', '4')

    const stats = await getAdminCacheStats()

    const counts = Object.fromEntries(stats.buckets.map((bucket) => [bucket.id, bucket.keyCount]))
    expect(counts).toEqual({ og: 2, avatar: 1, calendar: 1, 'image-meta': 0, 'comments-md': 0 })
    expect(stats.total).toBe(4)
  })

  it('clears only the targeted bucket', async () => {
    fixture.store.set('og-hello-deadbeef', new Uint8Array([1]))
    fixture.store.set('og-world-cafef00d', new Uint8Array([2]))
    fixture.store.set('avatar-abc', new Uint8Array([3]))
    fixture.store.set('session:xyz', 'cookie-payload')

    const result = await clearAdminCache('og')

    expect(result.cleared).toEqual([{ bucketId: 'og', label: 'OG 图缓存', removed: 2 }])
    expect(result.total).toBe(2)
    expect([...fixture.store.keys()].sort()).toEqual(['avatar-abc', 'session:xyz'])
    // Refreshed snapshot should reflect the deletion.
    expect(result.refreshedStats.buckets.find((bucket) => bucket.id === 'og')?.keyCount).toBe(0)
    expect(result.refreshedStats.buckets.find((bucket) => bucket.id === 'avatar')?.keyCount).toBe(1)
  })

  it('aggregates counts when clearing all buckets', async () => {
    fixture.store.set('og-hello-deadbeef', new Uint8Array([1]))
    fixture.store.set('avatar-abc', new Uint8Array([2]))
    fixture.store.set('avatar-def', new Uint8Array([3]))
    fixture.store.set('calendar-2026-04-30', new Uint8Array([4]))
    fixture.store.set('session:xyz', 'cookie-payload')

    const result = await clearAdminCache('all')

    expect(result.total).toBe(4)
    const cleared = Object.fromEntries(result.cleared.map((entry) => [entry.bucketId, entry.removed]))
    expect(cleared).toEqual({ og: 1, avatar: 2, calendar: 1, 'image-meta': 0, 'comments-md': 0 })
    // Out-of-bucket keys (sessions, rate-limit) survive a "全部清空".
    expect([...fixture.store.keys()]).toEqual(['session:xyz'])
  })

  it('rejects unknown bucket targets with ActionFailure', async () => {
    await expect(clearAdminCache('nope' as never)).rejects.toBeInstanceOf(ActionFailure)
  })

  it('returns 0 deletions when the bucket is already empty', async () => {
    const result = await clearAdminCache('og')
    expect(result.total).toBe(0)
    expect(result.cleared[0]?.removed).toBe(0)
    expect(fixture.unlink).not.toHaveBeenCalled()
  })

  it('honors a renamed prefix from the live snapshot', async () => {
    // Editor renamed the OG bucket via the admin panel. The SCAN
    // pattern + key matching must follow the rename immediately, so
    // legacy keys under the previous prefix are NOT touched while the
    // renamed bucket targets the new pattern.
    setBlogSettingsBundleForTests({
      ...TEST_BLOG_SETTINGS_BUNDLE,
      cache: {
        cache: {
          ...TEST_BLOG_SETTINGS_BUNDLE.cache!.cache,
          og: { prefix: 'opengraph-', ttlSeconds: TEST_BLOG_SETTINGS_BUNDLE.cache!.cache.og.ttlSeconds },
        },
      },
    })
    fixture.store.set('opengraph-fresh-deadbeef', new Uint8Array([1]))
    fixture.store.set('og-stale-deadbeef', new Uint8Array([2])) // legacy key under the old prefix
    fixture.store.set('avatar-abc', new Uint8Array([3]))

    const stats = await getAdminCacheStats()
    expect(stats.buckets.find((bucket) => bucket.id === 'og')?.pattern).toBe('opengraph-*')
    expect(stats.buckets.find((bucket) => bucket.id === 'og')?.keyCount).toBe(1)

    const cleared = await clearAdminCache('og')
    expect(cleared.total).toBe(1)
    // Legacy `og-stale-…` key is NOT touched — that's the documented
    // behaviour: old keys age out at their stored TTL.
    expect([...fixture.store.keys()].sort()).toEqual(['avatar-abc', 'og-stale-deadbeef'])
  })

  it('exposes prefix + TTL on every stats entry', async () => {
    fixture.store.set('og-hello-x', new Uint8Array([1]))
    const stats = await getAdminCacheStats()

    const og = stats.buckets.find((bucket) => bucket.id === 'og')
    const cacheFixture = TEST_BLOG_SETTINGS_BUNDLE.cache!.cache
    expect(og?.prefix).toBe(cacheFixture.og.prefix)
    expect(og?.ttlSeconds).toBe(cacheFixture.og.ttlSeconds)
    expect(og?.pattern).toBe(`${cacheFixture.og.prefix}*`)
  })

  // The `image-meta` and `comments-md` buckets used to be process-local
  // `lru-cache` instances; routing them through Redis means the admin
  // panel is now the single source of truth for invalidation, so the
  // SCAN + UNLINK contract has to cover them too.
  it('scans and clears the image-meta + comments-md buckets the same way as og/avatar/calendar', async () => {
    fixture.store.set('image-meta-images/2024/06/cover.jpg', JSON.stringify({ found: true }))
    fixture.store.set('image-meta-images/2024/06/banner.jpg', JSON.stringify({ found: false }))
    fixture.store.set('comments-md-deadbeefcafef00d', '<p>hi</p>')
    fixture.store.set('og-foo', new Uint8Array([1]))

    const stats = await getAdminCacheStats()
    const counts = Object.fromEntries(stats.buckets.map((b) => [b.id, b.keyCount]))
    expect(counts['image-meta']).toBe(2)
    expect(counts['comments-md']).toBe(1)

    const result = await clearAdminCache('image-meta')
    expect(result.total).toBe(2)
    expect(result.cleared[0]?.bucketId).toBe('image-meta')
    // og + comments-md keys survive a targeted image-meta sweep.
    expect([...fixture.store.keys()].sort()).toEqual(['comments-md-deadbeefcafef00d', 'og-foo'])
  })
})
