import { describe, expect, it, vi } from 'vite-plus/test'

// Feed routes are thin pass-throughs to `feedResponse`. We mock it to assert
// the route surface without exercising the catalog / XML envelope (those are
// covered separately by the `service.feed.*` test).
//
// Six public feed URLs are served by the Hono feedRouter. The shared
// `scopeFromUrl` helper figures out whether a request is for the root, a
// category, or a tag based on the pathname — so the test exercises all six
// URLs through the same router.

const feedResponseMock = vi.fn(
  async (kind: string) =>
    new Response(`<feed kind="${kind}" />`, {
      headers: { 'content-type': kind === 'rss' ? 'application/rss+xml' : 'application/atom+xml' },
    }),
)
vi.mock('@/server/feed', () => ({
  feedResponse: feedResponseMock,
  feedHeaders: vi.fn((kind: string) => ({
    'Content-Type': kind === 'rss' ? 'application/rss+xml' : 'application/atom+xml',
  })),
  generateFeeds: vi.fn(),
}))

const { feedRouter } = await import('@/server/http/resources/feed')
const { scopeFromUrl } = await import('@/server/feed/scope')

describe('routes/feed Hono router', () => {
  it("/feed delegates to feedResponse('rss') without a scope", async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/feed')
    expect(feedResponseMock).toHaveBeenCalledWith('rss', undefined)
  })

  it("/feed/atom delegates to feedResponse('atom') without a scope", async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/feed/atom')
    expect(feedResponseMock).toHaveBeenCalledWith('atom', undefined)
  })

  it('/cats/:slug/feed delegates with category scoped to the slug param', async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/cats/general/feed')
    expect(feedResponseMock).toHaveBeenCalledWith('rss', { category: 'general' })
  })

  it('/cats/:slug/feed/atom delegates with category scoped to the slug param', async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/cats/general/feed/atom')
    expect(feedResponseMock).toHaveBeenCalledWith('atom', { category: 'general' })
  })

  it('/tags/:slug/feed delegates with tag scoped to the slug param', async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/tags/typescript/feed')
    expect(feedResponseMock).toHaveBeenCalledWith('rss', { tag: 'typescript' })
  })

  it('/tags/:slug/feed/atom delegates with tag scoped to the slug param', async () => {
    feedResponseMock.mockClear()
    await feedRouter.request('http://localhost/tags/typescript/feed/atom')
    expect(feedResponseMock).toHaveBeenCalledWith('atom', { tag: 'typescript' })
  })

  it('the response carries the canonical feed content-type headers', async () => {
    const rss = await feedRouter.request('http://localhost/feed')
    expect(rss.headers.get('content-type')).toContain('rss+xml')
    const atom = await feedRouter.request('http://localhost/feed/atom')
    expect(atom.headers.get('content-type')).toContain('atom+xml')
  })
})

describe('routes/feed scopeFromUrl', () => {
  it('returns undefined when no slug is matched (root /feed)', () => {
    expect(scopeFromUrl('http://localhost/feed', undefined)).toBeUndefined()
  })

  it('returns category scope for /cats/:slug/feed{/atom}', () => {
    expect(scopeFromUrl('http://localhost/cats/general/feed', 'general')).toEqual({
      category: 'general',
    })
    expect(scopeFromUrl('http://localhost/cats/general/feed/atom', 'general')).toEqual({
      category: 'general',
    })
  })

  it('returns tag scope for /tags/:slug/feed{/atom}', () => {
    expect(scopeFromUrl('http://localhost/tags/typescript/feed', 'typescript')).toEqual({
      tag: 'typescript',
    })
  })

  it("returns undefined when slug is set but URL doesn't match cats/tags (defensive)", () => {
    expect(scopeFromUrl('http://localhost/something/else', 'x')).toBeUndefined()
  })
})
