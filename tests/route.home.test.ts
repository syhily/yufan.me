import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeCategory, makePostList, makeTag } from './_helpers/catalog'
import { makeLoaderArgs } from './_helpers/context'
import { regularSession } from './_helpers/session'

// `home` loader is the SSR fan-out for `/` and `/page/:num`. The route is
// part of the public URL surface (`AGENTS.md`: "/" canonical, "/page/N"
// 30x to /N=1 etc.) so we pin its three observable contracts:
//
//   1. /page/1 redirects to / (canonical collapse).
//   2. The 3-block payload (listing, sidebar, seo) is shaped correctly
//      for both the canonical / and the deep-paginated /page/N case.
//   3. Out-of-range pagination triggers a redirect to the last real page.

const session = regularSession()

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session),
    isAdmin: vi.fn((s) => Boolean(s?.data?.user?.admin)),
    userSession: vi.fn((s) => s?.data?.user),
    resolveSessionContext: vi.fn(async () => ({
      session,
      user: session?.data?.user,
      admin: Boolean(session?.data?.user?.admin),
    })),
  }
})

const allPosts = makePostList(7, { slug: 'post' })
const sampleCategory = makeCategory({ name: 'general', slug: 'general' })
const sampleTag = makeTag({ name: 'typescript', slug: 'typescript' })

vi.mock('@/server/catalog', () => ({
  getCatalog: vi.fn(async () => ({
    tags: [sampleTag],
    getPosts: vi.fn(() => allPosts),
    getClientPosts: vi.fn(() => allPosts),
    getCategoriesByName: vi.fn(() => [sampleCategory]),
    getCategoryLink: vi.fn((name: string) => (name === sampleCategory.name ? sampleCategory.permalink : '')),
  })),
  getClientPostsWithMetadata: vi.fn(async (posts: unknown[]) =>
    (posts as Array<{ slug: string; permalink: string }>).map((p) => ({
      ...p,
      likes: 0,
      views: 0,
      comments: 0,
    })),
  ),
  toClientPost: (p: unknown) => p,
  toListingPostCard: (p: unknown) => p,
  toSidebarPostLink: (p: unknown) => p,
  ContentCatalog: class {},
}))

vi.mock('@/server/sidebar/load', () => ({
  loadSidebarData: vi.fn(async () => ({
    admin: false,
    recentComments: [],
    pendingComments: [],
  })),
}))

const { loader } = await import('@/routes/home')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('routes/home loader', () => {
  it('/page/1 collapses to / (canonical) via 30x redirect', async () => {
    await expect(
      loader(
        makeLoaderArgs({
          request: new Request('http://localhost/page/1'),
          session,
          params: { num: '1' },
        }),
      ),
    ).rejects.toMatchObject({ status: 302 })
  })

  it('returns the unified listing payload (resolvedPosts, extra.sidebar, empty seo) on /', async () => {
    const result = await loader(
      makeLoaderArgs({
        request: new Request('http://localhost/'),
        session,
        params: {},
      }),
    )

    expect(result.pageNum).toBe(1)
    expect(result.seo).toEqual([])
    expect(result.totalPage).toBeGreaterThan(0)
    expect(Array.isArray(result.resolvedPosts)).toBe(true)
    expect(Object.keys(result.extra.categoryLinks)).toContain('general')
    expect(result.extra.sidebar.recentComments).toEqual([])
  })

  it('returns the deep-paginated payload (with seo populated) on /page/N', async () => {
    // The mocked listing has 7 posts; with default pagination (likely 6/page)
    // page 2 should be a valid deep-page render.
    const result = await loader(
      makeLoaderArgs({
        request: new Request('http://localhost/page/2'),
        session,
        params: { num: '2' },
      }),
    )

    expect(result.pageNum).toBe(2)
    expect(Array.isArray(result.seo)).toBe(true)
    expect(result.seo.length).toBeGreaterThan(0)
    const canonical = result.seo.find(
      (tag) =>
        tag !== null &&
        typeof tag === 'object' &&
        'tagName' in tag &&
        tag.tagName === 'link' &&
        tag.rel === 'canonical',
    ) as { href: string } | undefined
    expect(canonical?.href).toContain('/page/2')
    const robots = result.seo.find(
      (tag) => tag !== null && typeof tag === 'object' && 'name' in tag && tag.name === 'robots',
    ) as { content: string } | undefined
    expect(robots?.content).toContain('noindex')
  })

  it('redirects /page/N to the last valid page when N overflows', async () => {
    await expect(
      loader(
        makeLoaderArgs({
          request: new Request('http://localhost/page/9999'),
          session,
          params: { num: '9999' },
        }),
      ),
    ).rejects.toMatchObject({ status: 302 })
  })
})
