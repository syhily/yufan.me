import { describe, expect, it, vi } from 'vite-plus/test'

// Feed routes are thin pass-throughs to `feedResponse`. We mock it to assert
// the route surface without exercising the catalog / XML envelope (those are
// covered separately by the `service.feed.*` test).
//
// Six public feed URLs share two route modules (`feed.rss.ts`, `feed.atom.ts`)
// after the route-merge refactor. The shared `scopeFromUrl` helper figures
// out whether a request is for the root, a category, or a tag based on the
// pathname — so the test exercises all six URLs through the surviving two
// loaders.

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

const { loader: rssLoader, scopeFromUrl } = await import('@/routes/feed.rss')
const { loader: atomLoader } = await import('@/routes/feed.atom')

const callRss = (url: string, params: Record<string, string | undefined> = {}) =>
  rssLoader({ request: new Request(url), params } as never)

const callAtom = (url: string, params: Record<string, string | undefined> = {}) =>
  atomLoader({ request: new Request(url), params } as never)

describe('routes/feed loaders', () => {
  it("/feed delegates to feedResponse('rss') without a scope", async () => {
    feedResponseMock.mockClear()
    await callRss('http://localhost/feed')
    expect(feedResponseMock).toHaveBeenCalledWith('rss', undefined)
  })

  it("/feed/atom delegates to feedResponse('atom') without a scope", async () => {
    feedResponseMock.mockClear()
    await callAtom('http://localhost/feed/atom')
    expect(feedResponseMock).toHaveBeenCalledWith('atom', undefined)
  })

  it('/cats/:slug/feed delegates with category scoped to params.slug', async () => {
    feedResponseMock.mockClear()
    await callRss('http://localhost/cats/general/feed', { slug: 'general' })
    expect(feedResponseMock).toHaveBeenCalledWith('rss', { category: 'general' })
  })

  it('/cats/:slug/feed/atom delegates with category scoped to params.slug', async () => {
    feedResponseMock.mockClear()
    await callAtom('http://localhost/cats/general/feed/atom', { slug: 'general' })
    expect(feedResponseMock).toHaveBeenCalledWith('atom', { category: 'general' })
  })

  it('/tags/:slug/feed delegates with tag scoped to params.slug', async () => {
    feedResponseMock.mockClear()
    await callRss('http://localhost/tags/typescript/feed', { slug: 'typescript' })
    expect(feedResponseMock).toHaveBeenCalledWith('rss', { tag: 'typescript' })
  })

  it('/tags/:slug/feed/atom delegates with tag scoped to params.slug', async () => {
    feedResponseMock.mockClear()
    await callAtom('http://localhost/tags/typescript/feed/atom', { slug: 'typescript' })
    expect(feedResponseMock).toHaveBeenCalledWith('atom', { tag: 'typescript' })
  })

  it('the response carries the canonical feed content-type headers', async () => {
    const rss = await callRss('http://localhost/feed')
    expect(rss.headers.get('content-type')).toContain('rss+xml')
    const atom = await callAtom('http://localhost/feed/atom')
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
