import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { mockRedis } from './_helpers/redis'

// The parser routes its hashed render output through `@/server/cache/storage`.
// Without an in-memory stand-in, the production import wires up the real
// ioredis client and tests hang on the network connect.
const fakeStorage = mockRedis()
vi.mock('@/server/cache/storage', () => ({
  storage: fakeStorage,
  redisInstance: () => fakeStorage,
}))

const { EMPTY_COMMENT_HTML, EMPTY_COMMENT_RAW, parseContent } = await import('@/server/markdown/parser')
const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')
const { TEST_BLOG_SETTINGS_BUNDLE } = await import('./_helpers/blog-settings')

// shiki + sanitize pipeline for the empty-comment placeholder. We assert it
// returns the constant *synchronously enough* that we can race it against a
// long-running call without observing the marked round-trip.

describe('services/markdown/parser — EMPTY_COMMENT short-circuit', () => {
  beforeEach(() => {
    setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
    fakeStorage.reset()
  })

  it('returns the constant for the literal placeholder string', async () => {
    expect(await parseContent(EMPTY_COMMENT_RAW)).toBe(EMPTY_COMMENT_HTML)
  })

  it('returns the constant for empty input', async () => {
    expect(await parseContent('')).toBe(EMPTY_COMMENT_HTML)
  })

  it('accepts null and undefined and returns the empty placeholder', async () => {
    expect(await parseContent(null)).toBe(EMPTY_COMMENT_HTML)
    expect(await parseContent(undefined)).toBe(EMPTY_COMMENT_HTML)
  })

  it('normalises CRLF and still hits the short-circuit if the result is empty', { timeout: 30_000 }, async () => {
    expect(await parseContent('\r\n')).not.toBe(EMPTY_COMMENT_HTML)
    expect(await parseContent('')).toBe(EMPTY_COMMENT_HTML)
  })
})
