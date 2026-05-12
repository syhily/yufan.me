import { describe, expect, it, vi } from 'vite-plus/test'

import { makePage, makePost } from './_helpers/catalog'

// The sitemap is the single most-consumed URL by external crawlers; if we
// silently drop a category of content from it (posts vs pages, hidden flag
// behaviour, ordering) Search Console takes weeks to recover. Pin both the
// content set and the wrapping <urlset> envelope.

const mocks = vi.hoisted(() => ({
  listAllPosts: vi.fn(),
  listAllPages: vi.fn(),
}))

vi.mock('@/server/posts/query', () => ({
  listAllPosts: mocks.listAllPosts,
}))
vi.mock('@/server/pages/query', () => ({
  listAllPages: mocks.listAllPages,
}))

const { loader } = await import('@/routes/sitemap')

function fakeCatalog(opts: { posts: ReturnType<typeof makePost>[]; pages: ReturnType<typeof makePage>[] }) {
  mocks.listAllPosts.mockResolvedValue(opts.posts)
  mocks.listAllPages.mockResolvedValue(opts.pages)
}

describe('routes/sitemap loader', () => {
  it('emits a well-formed XML envelope with the canonical Cache-Control', async () => {
    fakeCatalog({ posts: [], pages: [] })

    const response = await loader({ request: new Request('http://x/sitemap.xml') } as never)

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')

    const xml = await response.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.endsWith('</urlset>')).toBe(true)
    expect(xml).toContain('<loc>https://yufan.me/</loc>')
  })

  it('includes one <url> per published post and per page', async () => {
    fakeCatalog({
      posts: [
        makePost({
          slug: 'p1',
          permalink: '/posts/p1',
          date: new Date('2024-01-01T00:00:00.000Z'),
        }),
        makePost({
          slug: 'p2',
          permalink: '/posts/p2',
          date: new Date('2024-02-01T00:00:00.000Z'),
        }),
      ],
      pages: [
        makePage({
          slug: 'about',
          permalink: '/about',
          date: new Date('2023-06-01T00:00:00.000Z'),
        }),
      ],
    })

    const response = await loader({ request: new Request('http://x/sitemap.xml') } as never)
    const xml = await response.text()

    expect(xml).toContain('<loc>https://yufan.me/posts/p1</loc>')
    expect(xml).toContain('<loc>https://yufan.me/posts/p2</loc>')
    expect(xml).toContain('<loc>https://yufan.me/about</loc>')
    expect(xml).toContain('<lastmod>2024-01-01T00:00:00.000Z</lastmod>')
    expect(xml).toContain('<lastmod>2023-06-01T00:00:00.000Z</lastmod>')
  })

  it('asks the catalog for hidden-inclusive, non-scheduled posts', async () => {
    mocks.listAllPosts.mockResolvedValue([])
    mocks.listAllPages.mockResolvedValue([])

    await loader({ request: new Request('http://x/sitemap.xml') } as never)

    expect(mocks.listAllPosts).toHaveBeenCalledWith({
      includeHidden: true,
      includeScheduled: false,
    })
  })
})
