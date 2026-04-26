import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { wpDecoyMiddleware } from '@/server/middleware-wp-decoy'
import { isWordPressDecoyPath, NOT_WORDPRESS_STATUS_TEXT, notWordPressSite } from '@/server/route-helpers/wp-decoy'

import { makePage, makePost } from './_helpers/catalog'
import { makeLoaderArgs } from './_helpers/context'
import { regularSession } from './_helpers/session'

// WordPress probe decoy contract. Three layers under test:
//   1. `isWordPressDecoyPath` — pure predicate matching the patterns the
//      project agreed to intercept.
//   2. `wpDecoyMiddleware` — the single chokepoint that runs on the root
//      route before any other loader, throwing the canonical `404`
//      Response carrying the `Not WordPress` marker.
//   3. `routes/page.detail.tsx` — sanity check that real page slugs still
//      resolve through the page-detail loader (the middleware is what
//      handles probes; the loader no longer re-checks).

const session = regularSession()

const fixtures = vi.hoisted(() => ({
  samplePost: { slug: 'hello', mdxPath: '2024/2024-01-01-hello.mdx' } as Record<string, unknown>,
  samplePage: { slug: 'about', mdxPath: 'about.mdx' } as Record<string, unknown>,
}))
fixtures.samplePost = {
  ...makePost({ slug: 'hello', alias: ['hello-old'] }),
  mdxPath: '2024/2024-01-01-hello.mdx',
}
fixtures.samplePage = { ...makePage({ slug: 'about' }), mdxPath: 'about.mdx' }

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session),
    isAdmin: vi.fn(() => false),
    userSession: vi.fn((s: { data?: { user?: unknown } } | undefined) => s?.data?.user),
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
    getPost: vi.fn((slug: string) => (slug === 'hello' ? fixtures.samplePost : undefined)),
    getPage: vi.fn((slug: string) => (slug === 'about' ? fixtures.samplePage : undefined)),
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
}))

const pageDetailRoute = await import('@/routes/page.detail')

beforeEach(() => {
  vi.clearAllMocks()
})

// Loaders / middlewares may be synchronous or async. Wrap the call in a
// thunk so the try/catch catches both styles uniformly.
async function captureThrown(call: () => unknown): Promise<unknown> {
  try {
    await call()
  } catch (err) {
    return err
  }
  throw new Error('expected call to throw')
}

describe('isWordPressDecoyPath', () => {
  it('matches WordPress probe patterns', () => {
    const probes = [
      '/wp-admin/options.php',
      '/wp-admin/setup-config.php',
      '/wp-content/plugins/x.php',
      '/wp-content/uploads/img.jpg',
      '/wp-includes/wlwmanifest.xml',
      '/cgi-bin',
      '/cgi-bin/test.cgi',
      '/xmlrpc.php',
      '/index.php',
      '/blog/index.php',
    ]
    for (const path of probes) {
      expect(isWordPressDecoyPath(path), path).toBe(true)
    }
  })

  it('preserves the three legitimate WordPress-style routes', () => {
    expect(isWordPressDecoyPath('/wp-login.php')).toBe(false)
    expect(isWordPressDecoyPath('/wp-admin')).toBe(false)
    expect(isWordPressDecoyPath('/wp-admin/install.php')).toBe(false)
  })

  it('ignores unrelated paths', () => {
    const ordinary = [
      '/',
      '/posts/hello',
      '/about',
      '/cats/general',
      '/tags/typescript',
      '/search/foo',
      '/feed',
      '/sitemap.xml',
      '/cgi-binx',
      '/wp-adminx',
    ]
    for (const path of ordinary) {
      expect(isWordPressDecoyPath(path), path).toBe(false)
    }
  })
})

describe('notWordPressSite', () => {
  it('throws a 404 Response tagged with the Not WordPress marker', () => {
    let thrown: unknown
    try {
      notWordPressSite()
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Response)
    const response = thrown as Response
    expect(response.status).toBe(404)
    expect(response.statusText).toBe(NOT_WORDPRESS_STATUS_TEXT)
  })
})

describe('wpDecoyMiddleware (single-segment + multi-segment probes)', () => {
  const callMiddleware = (request: Request) => {
    const next = vi.fn(async () => new Response('ok'))
    return wpDecoyMiddleware(makeLoaderArgs({ request }) as never, next as () => Promise<Response>)
  }

  it('throws the WP-decoy 404 for multi-segment probe paths', async () => {
    const thrown = await captureThrown(() => callMiddleware(new Request('http://localhost/wp-content/plugins/foo.php')))
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(404)
    expect((thrown as Response).statusText).toBe(NOT_WORDPRESS_STATUS_TEXT)
  })

  it('throws the WP-decoy 404 for single-segment .php probes', async () => {
    const thrown = await captureThrown(() => callMiddleware(new Request('http://localhost/xmlrpc.php')))
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(404)
    expect((thrown as Response).statusText).toBe(NOT_WORDPRESS_STATUS_TEXT)
  })

  it('throws the WP-decoy 404 for the bare /cgi-bin segment', async () => {
    const thrown = await captureThrown(() => callMiddleware(new Request('http://localhost/cgi-bin')))
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(404)
    expect((thrown as Response).statusText).toBe(NOT_WORDPRESS_STATUS_TEXT)
  })

  it('delegates to next() for ordinary paths', async () => {
    const next = vi.fn(async () => new Response('ok'))
    const result = await wpDecoyMiddleware(
      makeLoaderArgs({ request: new Request('http://localhost/posts/hello') }) as never,
      next as () => Promise<Response>,
    )
    expect(next).toHaveBeenCalledOnce()
    expect((result as Response).status).toBe(200)
  })
})

describe('routes/page.detail loader (probe interception now lives in middleware)', () => {
  it('still serves real page slugs', async () => {
    const data = (await pageDetailRoute.loader(
      makeLoaderArgs({
        request: new Request('http://localhost/about'),
        session,
        params: { slug: 'about' },
      }),
    )) as { page: { permalink: string } }
    expect(data.page.permalink).toBe('/about')
  })
})
