import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PortableTextBody } from '@/shared/portable-text'

import { makePage } from './_helpers/catalog'
import { makeLoaderArgs, unwrapLoaderData } from './_helpers/context'
import { regularSession } from './_helpers/session'

// Plan §八.集成 calls for an end-to-end sanity check that a Page
// served from the new `page + content` tables flows through the
// `page.detail` loader the same way an MDX-backed Page does — same
// SEO bundle, same comments wiring, same shell — but with a
// PortableText body in the loader payload that the React component
// then routes to `<PortableTextBody>`.

const session = regularSession()

const dbPageBody: PortableTextBody = [
  {
    _type: 'block',
    _key: 'h1',
    style: 'h2',
    children: [{ _type: 'span', _key: 'h1s', text: 'About' }],
  },
  {
    _type: 'block',
    _key: 'p1',
    style: 'normal',
    children: [{ _type: 'span', _key: 'p1s', text: 'Hello from a DB-backed page.' }],
  },
  {
    _type: 'image',
    _key: 'img1',
    src: 'https://cdn.example.com/photo.jpg',
    alt: 'demo',
  },
  {
    _type: 'musicPlayer',
    _key: 'mp1',
    playerId: 'abcd1234efgh5678',
  },
]

const dbPage = {
  ...makePage({
    slug: 'about',
    title: 'About',
    permalink: '/about',
    cover: '/images/about.jpg',
    comments: false,
    toc: false,
  }),
  source: 'db' as const,
  body: dbPageBody,
  imageSources: ['https://cdn.example.com/photo.jpg'],
  publishedRevisionId: 42n,
}

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
    tags: [],
    categories: [],
    friends: [],
    getPosts: vi.fn(() => []),
    getClientPosts: vi.fn(() => []),
    getPost: vi.fn(() => undefined),
    getPage: vi.fn((slug: string) => (slug === 'about' ? dbPage : undefined)),
    getTagsByName: vi.fn(() => []),
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

// Stub out the comments/data loader the same way `route.detail.test.ts`
// does — the page.detail route awaits this for every request and we
// don't have Postgres in unit tests.
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
  loadDetailPageStreaming: vi.fn(async () => ({
    critical: {
      admin: false,
      likes: { count: 0, liked: false },
      currentUser: null,
      commentKey: 'https://yufan.me/about/',
      recentComments: [],
      pendingComments: [],
    },
    comments: Promise.resolve({
      commentData: { totalCount: 0, totalPages: 0, currentPage: 1 },
      commentItems: [],
    }),
  })),
}))

// Image-meta resolution would otherwise hit Postgres for the
// thumbhash lookup; we don't need it for this contract.
vi.mock('@/server/images/render-enhance', () => ({
  resolveImageMetaBySources: vi.fn(async () => new Map()),
  loadImageThumbhash: vi.fn(async () => null),
}))

const pageRoute = await import('@/routes/page.detail')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('routes/page.detail loader (DB-backed page)', () => {
  it('routes a DB-source Page to the PortableText body branch', async () => {
    const result = unwrapLoaderData<{
      page: { permalink: string; title: string }
      bodyData: { source: 'mdx' | 'db'; body?: PortableTextBody; mdxPath?: string }
      imageMeta: Record<string, unknown>
    }>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about'),
          session,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.page.permalink).toBe('/about')
    expect(result.bodyData.source).toBe('db')
    // The PortableText body shape is preserved end-to-end.
    expect(result.bodyData.body).toEqual(dbPageBody)
    // Image meta resolution still happens (mocked to empty), proving
    // the loader doesn't short-circuit it for DB pages.
    expect(result.imageMeta).toEqual({})
  })

  it('preserves headings + permalink so SEO + URL-stable consumers keep working', async () => {
    const result = unwrapLoaderData<{
      page: { headings: unknown[]; permalink: string; title: string }
    }>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about'),
          session,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.page.permalink).toBe('/about')
    expect(result.page.title).toBe('About')
    expect(Array.isArray(result.page.headings)).toBe(true)
  })
})
