import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// `feedResponse` and `generateFeeds` thread a real `feed` package output, the
// content catalog, and `prerenderToNodeStream` together. We mock the catalog
// (no real MDX), keep the actual `feed` package, and pin the channel-level
// envelope so a future refactor of `index.server.tsx` cannot silently change
// the RSS/Atom output that downstream subscribers depend on.

const mocks = vi.hoisted(() => ({
  contentCatalogGet: vi.fn(),
}))

vi.mock('@/server/catalog', () => {
  return {
    ContentCatalog: {
      get: mocks.contentCatalogGet,
    },
  }
})

const { feedResponse, generateFeeds } = await import('@/server/feed')

function fakeCatalog(
  opts: {
    posts?: unknown[]
    categories?: { name: string; slug: string }[]
    tags?: { name: string; slug: string }[]
  } = {},
) {
  const categories = opts.categories ?? []
  const tags = opts.tags ?? []
  const catalog = {
    getPosts: vi.fn(() => opts.posts ?? []),
    getPostsByTaxonomy: vi.fn(() => []),
    getCategoryByName: vi.fn((name: string) => categories.find((cat) => cat.name === name)),
    getCategoryBySlug: vi.fn((slug: string) => categories.find((cat) => cat.slug === slug)),
    getTagByName: vi.fn((name: string) => tags.find((tag) => tag.name === name)),
    getTagBySlug: vi.fn((slug: string) => tags.find((tag) => tag.slug === slug)),
    getTagsByName: vi.fn(() => []),
    categories,
    tags,
  }
  mocks.contentCatalogGet.mockResolvedValue(catalog as never)
  return catalog
}

beforeEach(() => {
  mocks.contentCatalogGet.mockReset()
})

describe('services/feed — generateFeeds (channel envelope)', () => {
  it('produces both rss + atom strings even when there are zero posts', async () => {
    fakeCatalog()

    const feeds = await generateFeeds()

    expect(feeds.rss).toContain('<?xml version=')
    expect(feeds.atom).toContain('<?xml version=')
    expect(feeds.rss).toContain('<rss')
    expect(feeds.atom).toContain('<feed xml:lang="zh-CN" xmlns="http://www.w3.org/2005/Atom">')
  })

  it('declares zh-CN language on both feeds', async () => {
    fakeCatalog()
    const feeds = await generateFeeds()
    expect(feeds.rss).toContain('<language>zh-CN</language>')
    expect(feeds.atom).toContain('xml:lang="zh-CN"')
  })

  it('ships the legacy `WordPress 3.2.1` generator string (subscriber compat)', async () => {
    fakeCatalog()
    const feeds = await generateFeeds()
    expect(feeds.rss).toContain('<generator>WordPress 3.2.1</generator>')
  })

  it('selects hidden posts by default while still excluding scheduled posts', async () => {
    const catalog = fakeCatalog()

    await generateFeeds()

    expect(catalog.getPosts).toHaveBeenCalledWith({
      includeHidden: true,
      includeScheduled: false,
    })
  })

  it('uses the same hidden-inclusive visibility for scoped RSS/Atom feeds', async () => {
    const catalog = fakeCatalog({
      categories: [{ name: '技术', slug: 'tech' }],
      tags: [{ name: 'React', slug: 'react' }],
    })

    await generateFeeds({ category: 'tech' })

    expect(catalog.getPostsByTaxonomy).toHaveBeenLastCalledWith(
      { categoryName: '技术' },
      { includeHidden: true, includeScheduled: false },
    )

    await generateFeeds({ tag: 'react' })

    expect(catalog.getPostsByTaxonomy).toHaveBeenLastCalledWith(
      { tagName: 'React' },
      { includeHidden: true, includeScheduled: false },
    )
  })

  it('includes the iTunes-style stylesheet link in RSS for human readers', async () => {
    fakeCatalog()
    const feeds = await generateFeeds()
    expect(feeds.rss).toContain('/feed.xsl')
  })

  it('emits one <category> per known catalog category', async () => {
    fakeCatalog({
      categories: [
        { name: '技术', slug: 'tech' },
        { name: '杂谈', slug: 'misc' },
      ],
    })
    const feeds = await generateFeeds()
    expect(feeds.rss).toContain('<category>技术</category>')
    expect(feeds.rss).toContain('<category>杂谈</category>')
  })

  it('uses /cats/<slug>/feed and /cats/<slug>/feed/atom URLs when scoped to a category', async () => {
    fakeCatalog()
    const feeds = await generateFeeds({ category: 'tech' })
    // The feedLinks self-references appear in the channel header.
    expect(feeds.atom).toContain('/cats/tech/feed')
  })

  it('rejects calls that pass both category and tag', async () => {
    fakeCatalog()
    await expect(generateFeeds({ category: 'tech', tag: 'react' })).rejects.toThrow(/at the same time/)
  })
})

describe('services/feed — feedResponse (HTTP wrapper)', () => {
  it('rss returns application/xml; charset=utf-8', async () => {
    fakeCatalog()
    const response = await feedResponse('rss')
    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8')
    const body = await response.text()
    expect(body.startsWith('<?xml')).toBe(true)
  })

  it('atom returns application/atom+xml; charset=utf-8', async () => {
    fakeCatalog()
    const response = await feedResponse('atom')
    expect(response.headers.get('Content-Type')).toBe('application/atom+xml; charset=utf-8')
  })
})
