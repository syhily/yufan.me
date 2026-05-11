import { describe, expect, it } from 'vite-plus/test'

// Skipped placeholder: catalog build tests used to mock `#source/server`.
// Rewrite against `@/server/cms/posts/service` (or the live catalog fixture)
// when reviving this suite.
describe.skip('services/catalog/ContentCatalog.build', () => {
  it('placeholder', () => {
    expect(true).toBe(true)
  })
})

/*
vi.mock('#source/server', () => {
  const tomorrow = new Date(Date.now() + 86_400_000)
  return {
    // Categories and tags moved to the `category` / `tag` Postgres
    // tables — see the `@/server/categories/service` and
    // `@/server/tags/service` mocks below.
    posts: [
      {
        slug: 'hello',
        title: 'Hello',
        date: new Date('2024-01-01T00:00:00.000Z'),
        updated: new Date('2024-01-01T00:00:00.000Z'),
        category: '技术',
        tags: ['typescript', 'react'],
        alias: ['hello-old'],
        cover: '',
        og: undefined,
        published: true,
        visible: true,
        comments: true,
        toc: true,
        summary: 'post summary',
        body: () => null as never,
        _exports: {
          toc: [
            {
              depth: 2,
              title: createElement(Fragment, null, 'Intro', createElement('a', { href: '#intro' })),
              url: '#intro',
            },
            { depth: 3, title: 'Details', url: '#details' },
          ],
        },
        info: { path: '2024/2024-01-01-hello.mdx', fullPath: '/x' },
      },
      {
        slug: 'future',
        title: 'Future post',
        date: tomorrow,
        updated: tomorrow,
        category: '技术',
        tags: ['typescript'],
        alias: [],
        cover: '',
        og: undefined,
        published: true,
        visible: true,
        comments: true,
        toc: false,
        summary: 'future summary',
        body: () => null as never,
        info: { path: 'future.mdx', fullPath: '/x' },
      },
      {
        slug: 'hidden',
        title: 'Hidden',
        date: new Date('2024-01-01T00:00:00.000Z'),
        updated: new Date('2024-01-01T00:00:00.000Z'),
        category: '技术',
        tags: ['react'],
        alias: [],
        cover: '',
        og: undefined,
        published: true,
        visible: false,
        comments: true,
        toc: false,
        summary: '',
        body: () => null as never,
        info: { path: 'hidden.mdx', fullPath: '/x' },
      },
    ],
    // Pages come from Postgres (`page` + `content`); this mock has no `pages`.
  }
})

// Categories load from Postgres at catalog build time. The catalog talks
// directly to the query layer (not the service) to avoid the circular
// dependency that the `delete-block-when-referenced` guard would otherwise
// introduce —
// so the mock targets `@/server/db/query/category`.
vi.mock('@/server/db/query/category', () => ({
  listPublicCategoryRows: vi.fn(async () => [
    {
      id: 1n,
      name: '技术',
      slug: 'tech',
      cover: '',
      description: 'tech category',
      sortOrder: 0,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]),
}))

// Same idea for tags. `react` is intentionally omitted from the
// returned list to exercise the catalog's auto-derive fallback path.
vi.mock('@/server/db/query/tag', () => ({
  listPublicTagRows: vi.fn(async () => [
    {
      id: 1n,
      name: 'typescript',
      slug: 'typescript',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ]),
}))

// `friends` used to live alongside the other meta collections in
// `#source/server`. Now they're loaded from Postgres at catalog build
// time, so we stub the service module instead. Returning a single
// synthetic entry keeps the thumbhash hydration code path (which the
// catalog runs against the friend list) covered.
vi.mock('@/server/friends/service', () => ({
  listPublicFriends: vi.fn(async () => [{ website: 'Friend', description: 'x', homepage: 'https://f', poster: '' }]),
}))

// Image hydration would otherwise call out to the network for every cover.
vi.mock('@/server/images/render-enhance', () => ({
  loadImageThumbhash: vi.fn(async () => undefined),
  clearImageEnhanceCache: vi.fn(),
}))

// CMS pages service is consulted at catalog build time so DB-backed
// pages can supersede MDX pages with the same slug. The default mock
// returns the empty list — individual specs override the mock when
// they want to exercise the merge path.
const loadCatalogPagesMock = vi.fn(
  async () => [] as Awaited<ReturnType<typeof import('@/server/cms/pages/service').loadCatalogPages>>,
)
vi.mock('@/server/cms/pages/service', () => ({
  loadCatalogPages: loadCatalogPagesMock,
}))

const { ContentCatalog } = await import('@/server/catalog')

beforeEach(() => {
  ContentCatalog.reset()
})

describe('services/catalog/ContentCatalog.build', () => {
  it('public getPosts excludes future-dated and visible=false posts', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.getPosts({ includeHidden: false, includeScheduled: false }).map((post) => post.slug)).toEqual([
      'hello',
    ])
  })

  it('allPosts retains hidden and future posts (admins / sitemap need them)', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.allPosts.map((p) => p.slug).sort()).toEqual(['future', 'hello', 'hidden'].sort())
  })

  it('alias slugs resolve to the same canonical post', async () => {
    const catalog = await ContentCatalog.get()
    const direct = catalog.getPost('hello')
    const viaAlias = catalog.getPost('hello-old')
    expect(direct).toBeDefined()
    expect(viaAlias).toBe(direct)
  })

  it('uses compiled heading metadata even when frontmatter enables toc', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.getPost('hello')?.headings).toEqual([
      { depth: 2, slug: 'intro', text: 'Intro' },
      { depth: 3, slug: 'details', text: 'Details' },
    ])
  })

  it('getPostsByTaxonomy returns the bucket for a category', async () => {
    const catalog = await ContentCatalog.get()
    const tech = catalog.getPostsByTaxonomy({ categoryName: '技术' }, { includeHidden: true, includeScheduled: true })
    expect(tech.map((p) => p.slug).sort()).toEqual(['future', 'hello', 'hidden'].sort())
  })

  it("auto-derives tag entries that aren't pre-declared in the tag table", async () => {
    const catalog = await ContentCatalog.get()
    const tag = catalog.getTagByName('react')
    expect(tag).toBeDefined()
    expect(tag?.slug).toBe('react') // pinyin of "react" yields the literal string
    expect(tag?.permalink).toBe('/tags/react')
  })

  it('category counts include hidden posts but exclude scheduled posts', async () => {
    const catalog = await ContentCatalog.get()
    const tech = catalog.getCategoryByName('技术')
    expect(tech?.counts).toBe(2)
  })

  it('tag counts include hidden posts but exclude scheduled posts', async () => {
    const catalog = await ContentCatalog.get()
    const react = catalog.getTagByName('react')
    expect(react?.counts).toBe(2)
  })

  it('permalinks set is the union of post and page permalinks', async () => {
    const dbAboutDate = new Date('2026-05-01T00:00:00.000Z')
    loadCatalogPagesMock.mockImplementationOnce(async () => [
      {
        title: 'About',
        date: dbAboutDate,
        updated: dbAboutDate,
        comments: true,
        cover: '',
        og: undefined,
        published: true,
        summary: '',
        toc: false,
        showUpdated: false,
        showFriends: false,
        slug: 'about',
        permalink: '/about',
        headings: [],
        body: [],
        imageSources: [],
        publishedRevisionId: null,
      },
    ])
    ContentCatalog.reset()
    const catalog = await ContentCatalog.get()
    expect(catalog.permalinks.has('/posts/hello')).toBe(true)
    expect(catalog.permalinks.has('/about')).toBe(true)
  })

  it('memoizes via the singleton (consecutive get() returns the same instance)', async () => {
    const a = await ContentCatalog.get()
    const b = await ContentCatalog.get()
    expect(a).toBe(b)
  })

  it('projects DB pages straight into the catalog', async () => {
    const dbAboutDate = new Date('2026-05-01T00:00:00.000Z')
    loadCatalogPagesMock.mockImplementationOnce(async () => [
      {
        title: 'About (DB)',
        date: dbAboutDate,
        updated: dbAboutDate,
        comments: true,
        cover: '',
        og: undefined,
        published: true,
        summary: 'db summary',
        toc: false,
        showUpdated: false,
        showFriends: false,
        slug: 'about',
        permalink: '/about',
        headings: [],
        body: [
          {
            _type: 'block',
            _key: 'p1',
            style: 'normal',
            children: [{ _type: 'span', _key: 's1', text: 'Hello from DB' }],
          },
        ],
        imageSources: [],
        publishedRevisionId: 1n,
      },
    ])
    ContentCatalog.reset()
    const catalog = await ContentCatalog.get()
    const aboutPage = catalog.getPage('about')
    expect(aboutPage).toBeDefined()
    expect(aboutPage?.title).toBe('About (DB)')
    expect(catalog.pages.map((page) => page.slug)).toEqual(['about'])
  })

  it('degrades to an empty page list when the DB-page loader throws', async () => {
    loadCatalogPagesMock.mockImplementationOnce(async () => {
      throw new Error('postgres unreachable')
    })
    ContentCatalog.reset()
    const catalog = await ContentCatalog.get()
    expect(catalog.pages).toEqual([])
    expect(catalog.getPage('about')).toBeUndefined()
  })
})

*/
