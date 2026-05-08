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
  findCategoryBySlug: vi.fn(async (slug: string) => (slug === 'general' ? sampleCategory : null)),
  findTagBySlug: vi.fn(async (slug: string) => (slug === 'typescript' ? sampleTag : null)),
  listPostsByCategory: vi.fn(async (_name: string, options: { includeHidden?: boolean }) =>
    options?.includeHidden ? samplePosts : publicPosts,
  ),
  listPostsByTag: vi.fn(async (_name: string, options: { includeHidden?: boolean }) =>
    options?.includeHidden ? samplePosts : publicPosts,
  ),
  getPostsBySlugs: vi.fn(async (_slugs: string[], options: { includeHidden?: boolean }) =>
    options?.includeHidden ? samplePosts : publicPosts,
  ),
  getClientPostsWithMetadata: vi.fn(async (posts: unknown[]) =>
    (posts as Array<{ slug: string }>).map((p) => ({ ...p, meta: { likes: 0, views: 0, comments: 0 } })),
  ),
  toClientPost: (p: unknown) => p,
  toListingPostCard: (p: unknown) => p,
}))

vi.mock('@/server/posts/query', () => ({
  countPublicPosts: vi.fn(async (_filters: { includeHidden?: boolean; category?: string; tag?: string }) =>
    _filters?.includeHidden ? samplePosts.length : publicPosts.length,
  ),
  listPublicPostCardsPaginated: vi.fn(
    async (
      _pageNum: number,
      _pageSize: number,
      options: { includeHidden?: boolean; category?: string; tag?: string },
    ) => {
      const posts = options?.includeHidden ? samplePosts : publicPosts
      return { posts, total: posts.length }
    },
  ),
  getClientPostsWithMetadata: vi.fn(async (posts: unknown[]) =>
    (posts as Array<{ slug: string }>).map((p) => ({ ...p, meta: { likes: 0, views: 0, comments: 0 } })),
  ),
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
const searchIndexRoute = await import('@/routes/search.index')

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

describe('routes/search.index loader', () => {
  it('canonicalises progressive-enhancement search form submissions', () => {
    const response = searchIndexRoute.loader({
      request: new Request('http://localhost/search?q=react router'),
    } as never) as Response

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('/search/react%20router')
  })

  it('redirects empty /search visits home', () => {
    const response = searchIndexRoute.loader({
      request: new Request('http://localhost/search?q=   '),
    } as never) as Response

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('/')
  })
})
