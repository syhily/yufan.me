import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeCategory, makePage, makePost, makePostList, makeTag } from './_helpers/catalog'
import { makeLoaderArgs } from './_helpers/context'
import { regularSession } from './_helpers/session'

// post.detail / page.detail loaders form the most-trafficked SSR endpoints.
// Pin the alias 301 redirect, the page-vs-post-slug fallback redirect, and
// the 404 contracts that protect against catalog drift.

const session = regularSession()
const samplePost = {
  ...makePost({ slug: 'hello', alias: ['hello-old'] }),
  mdxPath: '2024/2024-01-01-hello.mdx',
}
const samplePage = { ...makePage({ slug: 'about' }), mdxPath: 'about.mdx' }
const sampleCategory = makeCategory({ name: 'general', slug: 'general' })
const sampleTag = makeTag({ name: 'typescript', slug: 'typescript' })
const sidebarSamples = makePostList(3, { slug: 'sidebar' })

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
      admin: false,
    })),
  }
})

vi.mock('@/server/catalog', () => ({
  getCatalog: vi.fn(async () => ({
    tags: [sampleTag],
    categories: [sampleCategory],
    friends: [],
    getPosts: vi.fn(() => sidebarSamples),
    getClientPosts: vi.fn(() => sidebarSamples),
    getPost: vi.fn((slug: string) => {
      if (slug === 'hello') {
        return samplePost
      }
      if (slug === 'hello-old') {
        return samplePost
      } // alias resolves to canonical
      return undefined
    }),
    getPage: vi.fn((slug: string) => (slug === 'about' ? samplePage : undefined)),
    getTagsByName: vi.fn(() => [sampleTag]),
    toClientPost: (p: unknown) => p,
    toClientPage: (p: unknown) => p,
  })),
  toClientPost: (p: unknown) => p,
  toClientPage: (p: unknown) => p,
  toListingPostCard: (p: unknown) => p,
  toDetailPostShell: (p: unknown) => p,
  toDetailPageShell: (p: unknown) => p,
  toSidebarPostLink: (p: unknown) => p,
  ContentCatalog: class {},
}))

vi.mock('@/ui/mdx/MdxContent', () => ({
  PostBody: () => null,
  PageBody: () => null,
  preloadPostBody: vi.fn(async () => undefined),
  preloadPageBody: vi.fn(async () => undefined),
}))

vi.mock('@/server/comments/page-data', () => ({
  loadDetailPageData: vi.fn(async () => ({
    admin: false,
    likes: { count: 0, liked: false },
    commentData: { totalCount: 0, totalPages: 0, currentPage: 1 },
    commentItems: [],
    currentUser: null,
    recentComments: [],
    pendingComments: [],
  })),
  // The detail loader now reads `loadDetailPageStreaming`; comments ride
  // along as a Promise so the loader can stream them through `<Await>`.
  loadDetailPageStreaming: vi.fn(async () => ({
    critical: {
      admin: false,
      likes: { count: 0, liked: false },
      currentUser: null,
      commentKey: 'https://yufan.me/posts/hello/',
      recentComments: [],
      pendingComments: [],
    },
    comments: Promise.resolve({
      commentData: { totalCount: 0, totalPages: 0, currentPage: 1 },
      commentItems: [],
    }),
  })),
}))

const postRoute = await import('@/routes/post.detail')
const pageRoute = await import('@/routes/page.detail')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('routes/post.detail loader', () => {
  it('301-redirects from a post alias to the canonical slug', async () => {
    await expect(
      postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello-old'),
          session,
          params: { slug: 'hello-old' },
        }),
      ),
    ).rejects.toMatchObject({ status: 301 })
  })

  it("404s when the slug isn't a known post or alias", async () => {
    await expect(
      postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/missing'),
          session,
          params: { slug: 'missing' },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('returns the canonical post payload for a real slug', async () => {
    const data = (await postRoute.loader(
      makeLoaderArgs({
        request: new Request('http://localhost/posts/hello'),
        session,
        params: { slug: 'hello' },
      }),
    )) as unknown as {
      post: { title: string; permalink: string }
      mdxPath: string
    }

    expect(data.post.title).toBe(samplePost.title)
    expect(data.post.permalink).toBe('/posts/hello')
    expect(data.mdxPath).toBe(samplePost.mdxPath)
  })
})

describe('routes/page.detail loader', () => {
  it('returns the canonical page payload for a real page slug', async () => {
    const data = (await pageRoute.loader(
      makeLoaderArgs({
        request: new Request('http://localhost/about'),
        session,
        params: { slug: 'about' },
      }),
    )) as { page: { permalink: string } }

    expect(data.page.permalink).toBe('/about')
  })

  it('301-redirects to /posts/:slug when a page slug actually belongs to a post', async () => {
    await expect(
      pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/hello'),
          session,
          params: { slug: 'hello' },
        }),
      ),
    ).rejects.toMatchObject({ status: 301 })
  })

  it('404s when neither page nor post matches the slug', async () => {
    await expect(
      pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/missing'),
          session,
          params: { slug: 'missing' },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
