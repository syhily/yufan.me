import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeCategory, makePost, makePostList, makeTag } from './_helpers/catalog'
import { adminSession, regularSession } from './_helpers/session'

// Listing routes (`/cats/:slug`, `/tags/:slug`, `/search/:keyword`) all share
// the same skeleton. We pin the public 404/redirect contracts that are part
// of the URL surface (AGENTS.md says these paths must remain stable forever).

let session = regularSession()
const publicPosts = makePostList(3, { slug: 'post' })
const hiddenPost = makePost({ slug: 'hidden-post', visible: false })
const samplePosts = [...publicPosts, hiddenPost]
const sampleCategory = makeCategory({ name: 'general', slug: 'general' })
const sampleTag = makeTag({ name: 'typescript', slug: 'typescript' })

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session),
    isAdmin: vi.fn(() => false),
    userSession: vi.fn((s) => s?.data?.user),
    resolveSessionContext: vi.fn(async () => ({
      session,
      user: session?.data?.user,
      admin: Boolean(session?.data?.user?.admin),
    })),
  }
})

vi.mock('@/server/catalog', () => ({
  getCatalog: vi.fn(async () => ({
    tags: [sampleTag],
    categories: [sampleCategory],
    getPosts: vi.fn(() => samplePosts),
    getClientPosts: vi.fn(() => samplePosts),
    getPostsBy: vi.fn(() => samplePosts),
    getPostsByTaxonomy: vi.fn((_filter, options) => (options.includeHidden ? samplePosts : publicPosts)),
    getPostsBySlugs: vi.fn((_slugs, options) => (options.includeHidden ? samplePosts : publicPosts)),
    getCategoryBySlug: vi.fn((slug: string) => (slug === 'general' ? sampleCategory : undefined)),
    getCategoryByName: vi.fn(() => sampleCategory),
    getCategoriesByName: vi.fn(() => [sampleCategory]),
    getCategoryLink: vi.fn((name: string) => (name === sampleCategory.name ? sampleCategory.permalink : '')),
    getTagBySlug: vi.fn((slug: string) => (slug === 'typescript' ? sampleTag : undefined)),
    getTagByName: vi.fn(() => sampleTag),
    toClientPost: (p: unknown) => p,
  })),
  getClientPostsWithMetadata: vi.fn(async (posts: unknown[]) =>
    (posts as Array<{ slug: string }>).map((p) => ({ ...p, likes: 0, views: 0, comments: 0 })),
  ),
  toClientPost: (p: unknown) => p,
  toListingPostCard: (p: unknown) => p,
  ContentCatalog: class {},
}))

vi.mock('@/server/sidebar/load', () => ({
  loadSidebarData: vi.fn(async () => ({ admin: false, recentComments: [], pendingComments: [] })),
}))

vi.mock('@/server/search', () => ({
  searchPostOptions: vi.fn(() => ({ includeHidden: true, includeScheduled: false })),
  searchPosts: vi.fn(async () => ({
    hits: samplePosts.map((p) => p.slug),
    page: 1,
    totalPages: 2,
  })),
}))

const categoryRoute = await import('@/routes/category.list')
const tagRoute = await import('@/routes/tag.list')
const searchRoute = await import('@/routes/search.list')

beforeEach(() => {
  vi.clearAllMocks()
  session = regularSession()
})

describe('routes/category.list loader', () => {
  it("404s when the slug doesn't match a known category", async () => {
    await expect(
      categoryRoute.loader({
        request: new Request('http://localhost/cats/missing'),
        params: { slug: 'missing' },
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('returns the canonical payload (admin/path/seo) for a real category', async () => {
    const data = await categoryRoute.loader({
      request: new Request('http://localhost/cats/general'),
      params: { slug: 'general' },
    } as never)

    expect(data.title).toBe('general')
    const canonical = data.seo.find(
      (tag) =>
        tag !== null &&
        typeof tag === 'object' &&
        'tagName' in tag &&
        tag.tagName === 'link' &&
        tag.rel === 'canonical',
    ) as { href: string } | undefined
    expect(canonical?.href).toContain('/cats/general')
  })

  it('includes hidden posts for public category visitors', async () => {
    const data = (await categoryRoute.loader({
      request: new Request('http://localhost/cats/general'),
      params: { slug: 'general' },
    } as never)) as { resolvedPosts: Array<{ slug: string }> }

    expect(data.resolvedPosts.map((post) => post.slug)).toContain('hidden-post')
  })

  it('includes hidden posts for admin category visitors', async () => {
    session = adminSession()

    const data = (await categoryRoute.loader({
      request: new Request('http://localhost/cats/general'),
      params: { slug: 'general' },
    } as never)) as { resolvedPosts: Array<{ slug: string }> }

    expect(data.resolvedPosts.map((post) => post.slug)).toContain('hidden-post')
  })
})

describe('routes/tag.list loader', () => {
  it("404s when the slug doesn't match a known tag", async () => {
    await expect(
      tagRoute.loader({
        request: new Request('http://localhost/tags/missing'),
        params: { slug: 'missing' },
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('returns the canonical payload for a real tag', async () => {
    const data = (await tagRoute.loader({
      request: new Request('http://localhost/tags/typescript'),
      params: { slug: 'typescript' },
    } as never)) as { title: string }

    expect(data.title).toContain('typescript')
  })

  it('includes hidden tag posts for public visitors', async () => {
    const data = (await tagRoute.loader({
      request: new Request('http://localhost/tags/typescript'),
      params: { slug: 'typescript' },
    } as never)) as { resolvedPosts: Array<{ slug: string }> }

    expect(data.resolvedPosts.map((post) => post.slug)).toContain('hidden-post')
  })
})

describe('routes/search.list loader', () => {
  it('redirects to / when the keyword is empty / whitespace', async () => {
    await expect(
      searchRoute.loader({
        request: new Request('http://localhost/search/'),
        params: { keyword: '   ' },
      } as never),
    ).rejects.toMatchObject({ status: 302 })
  })

  it('returns the search payload with forced noindex SEO for a real query', async () => {
    const data = await searchRoute.loader({
      request: new Request('http://localhost/search/react'),
      params: { keyword: 'react' },
    } as never)

    expect(data.title).toContain('react')
    const robots = data.seo.find(
      (tag) => tag !== null && typeof tag === 'object' && 'name' in tag && tag.name === 'robots',
    ) as { content: string } | undefined
    expect(robots?.content).toContain('noindex')
  })

  it('includes hidden posts in public search results', async () => {
    const data = (await searchRoute.loader({
      request: new Request('http://localhost/search/react'),
      params: { keyword: 'react' },
    } as never)) as { resolvedPosts: Array<{ slug: string }> }

    expect(data.resolvedPosts.map((post) => post.slug)).toContain('hidden-post')
  })
})
