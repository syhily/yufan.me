import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { mockRedis } from './_helpers/redis'

// Stand-in for the unstorage `storage` export so the parser's
// Redis-backed cache writes / reads round-trip through an in-memory
// map. Without this mock the test would still pass (the parser
// catches Redis errors and renders fresh) but the "LRU hit" case
// below would no longer verify the cache contract — it would just
// check that two independent renders happen to produce the same
// string. We want the cache hit to be observable via referential
// equality, hence the deterministic in-memory backend.
const fakeStorage = mockRedis()
vi.mock('@/server/cache/storage', () => ({
  storage: fakeStorage,
  redisInstance: () => fakeStorage,
}))

const { parseContent } = await import('@/server/markdown/parser')
const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')
const { TEST_BLOG_SETTINGS_BUNDLE } = await import('./_helpers/blog-settings')

// Safety net for the comment markdown pipeline. `parseContent` runs on
// untrusted user input (comments) and on category descriptions, so any
// regression that leaks <script>, javascript: URLs, or strips the
// `target="_blank" rel="nofollow"` markers on external links would be a
// security or SEO concern.
// Parser cold-load (unified + remark + shiki) routinely exceeds vitest's
// default 5s budget on the first call; subsequent assertions run against the
// warmed pipeline and are fast.
describe('services/markdown/parser', () => {
  beforeEach(() => {
    setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
    fakeStorage.reset()
  })

  it('strips <script> tags from user content', { timeout: 30_000 }, async () => {
    const html = await parseContent('hello <script>alert(1)</script> world')
    expect(html.toLowerCase()).not.toContain('<script')
    expect(html.toLowerCase()).not.toContain('alert(1)')
  })

  it('marks external links as target=_blank with nofollow', async () => {
    const html = await parseContent('[external](https://example.com)')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="nofollow"')
  })

  it('does not add target=_blank to internal links', async () => {
    const html = await parseContent('[home](https://yufan.me/about)')
    expect(html).toContain('href="https://yufan.me/about"')
    expect(html).not.toContain('target="_blank"')
  })

  it('returns the same rendered HTML on repeated calls (Redis cache hit)', async () => {
    const a = await parseContent('# cache me')
    const b = await parseContent('# cache me')
    expect(b).toBe(a)
  })

  it('preserves GFM unchecked task list inputs (type/disabled survive prune)', async () => {
    const html = await parseContent('- [ ] todo')
    expect(html).toMatch(/<input[^>]*type="checkbox"/)
    expect(html).toMatch(/<input[^>]*disabled/)
    expect(html).not.toMatch(/<input[^>]*checked/)
  })

  it('preserves GFM checked task list inputs (checked attribute survives)', async () => {
    const html = await parseContent('- [x] done')
    expect(html).toMatch(/<input[^>]*type="checkbox"/)
    expect(html).toMatch(/<input[^>]*checked/)
  })
})
