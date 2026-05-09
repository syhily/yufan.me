import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PortableTextBody } from '@/shared/portable-text'

import { makePage } from './_helpers/catalog'
import { makeLoaderArgs, unwrapLoaderData } from './_helpers/context'
import { adminSession, regularSession } from './_helpers/session'

// Draft-preview contract for `routes/page.detail`. Three states the
// route distinguishes via the `draftMarker` discriminator on the
// loader payload (and propagated to `PageDetailBody`):
//
//   - `'draft'`              — page is unpublished; admin sees the
//                              latest draft on the public URL.
//   - `'unpublished-draft'`  — published page + `?draft=true` + a
//                              newer draft revision exists. Body
//                              swaps to the draft.
//   - `'published-draft'`    — published page + `?draft=true` but no
//                              newer draft. Body stays on the
//                              published revision; the badge confirms
//                              parity.
//
// Anonymous visitors (and non-admin sessions) are never allowed to
// trip these branches: `?draft=true` is silently ignored, and an
// unpublished page still 404s.

const publishedBody: PortableTextBody = [
  {
    _type: 'block',
    _key: 'p1',
    style: 'normal',
    children: [{ _type: 'span', _key: 's1', text: 'Published body.' }],
  },
]

const draftBody: PortableTextBody = [
  {
    _type: 'block',
    _key: 'p2',
    style: 'normal',
    children: [{ _type: 'span', _key: 's2', text: 'Draft body.' }],
  },
]

const publishedPage = {
  ...makePage({ slug: 'about', title: 'About', permalink: '/about' }),
  body: publishedBody,
  imageSources: [],
  publishedRevisionId: 42n,
}

const unpublishedPage = {
  ...makePage({ slug: 'secret', title: 'Secret', permalink: '/secret' }),
  body: draftBody,
  imageSources: [],
  publishedRevisionId: null,
}

let adminFlag = false
let currentSession = regularSession()

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => currentSession),
    isAdmin: vi.fn(() => adminFlag),
    userSession: vi.fn((s: { data?: { user?: unknown } } | undefined) => s?.data?.user),
    resolveSessionContext: vi.fn(async () => ({
      session: currentSession,
      user: currentSession?.data?.user,
      admin: adminFlag,
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
    // Catalog only contains published pages — `secret` always misses.
    getPage: vi.fn((slug: string) => (slug === 'about' ? publishedPage : undefined)),
    getTagsByName: vi.fn(() => []),
    toClientPost: (p: unknown) => p,
    toClientPage: (p: unknown) => p,
  })),
  // The route projects a `CmsPage` returned from the service back into
  // the catalog `Page` shape via `buildDbPage`. The fixtures already
  // share that shape, so an identity projection keeps the test honest
  // without dragging in the real catalog module.
  buildDbPage: (p: unknown) => p,
  toClientPost: (p: unknown) => p,
  toClientPage: (p: unknown) => p,
  toListingPostCard: (p: unknown) => p,
  toDetailPostShell: (p: unknown) => p,
  toDetailPageShell: (p: unknown) => p,
  toSidebarPostLink: (p: unknown) => p,
  ContentCatalog: class {},
}))

vi.mock('@/server/cms/pages/service', () => ({
  loadPageDraftPreviewBySlug: vi.fn(),
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

vi.mock('@/server/images/render-enhance', () => ({
  resolveImageMetaBySources: vi.fn(async () => new Map()),
  loadImageThumbhash: vi.fn(async () => null),
}))

const pageRoute = await import('@/routes/page.detail')
const pagesService = await import('@/server/cms/pages/service')
const draftPreviewMock = vi.mocked(pagesService.loadPageDraftPreviewBySlug)

type LoaderResult = {
  page: { title: string }
  body: PortableTextBody
  draftMarker: 'draft' | 'unpublished-draft' | 'published-draft' | null
}

beforeEach(() => {
  vi.clearAllMocks()
  adminFlag = false
  currentSession = regularSession()
})

describe('routes/page.detail draft preview', () => {
  it('serves the published body without a marker for anonymous visitors', async () => {
    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about'),
          session: currentSession,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })

  it('ignores `?draft=true` for anonymous visitors on a published page', async () => {
    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about?draft=true'),
          session: currentSession,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    // The service is consulted only after we confirm the session is
    // an admin's. For non-admin requests we never even reach it.
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })

  it('404s anonymous visitors on an unpublished page', async () => {
    let thrown: unknown
    try {
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/secret'),
          session: currentSession,
          params: { slug: 'secret' },
        }),
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(404)
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })

  it('shows 【草稿】 for an admin viewing an unpublished page', async () => {
    adminFlag = true
    currentSession = adminSession()
    draftPreviewMock.mockResolvedValueOnce({ page: unpublishedPage, hasNewerDraft: true })

    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/secret'),
          session: currentSession,
          params: { slug: 'secret' },
        }),
      ),
    )

    expect(result.body).toEqual(draftBody)
    expect(result.draftMarker).toBe('draft')
  })

  it('shows 【未发布的草稿】 for an admin opening a published page with `?draft=true` when a newer draft exists', async () => {
    adminFlag = true
    currentSession = adminSession()
    // The service projects the meta + latest draft into a `CmsPage`
    // whose `body` is the draft. The route then swaps `sourcePage`
    // to that projection so the rendered body is the draft one.
    draftPreviewMock.mockResolvedValueOnce({
      page: { ...publishedPage, body: draftBody },
      hasNewerDraft: true,
    })

    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about?draft=true'),
          session: currentSession,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.body).toEqual(draftBody)
    expect(result.draftMarker).toBe('unpublished-draft')
  })

  it('shows 【已发布的草稿】 when an admin opens a published page with `?draft=true` and there is no newer draft', async () => {
    adminFlag = true
    currentSession = adminSession()
    draftPreviewMock.mockResolvedValueOnce({
      page: publishedPage,
      hasNewerDraft: false,
    })

    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about?draft=true'),
          session: currentSession,
          params: { slug: 'about' },
        }),
      ),
    )

    // No newer draft → body stays on the published revision.
    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBe('published-draft')
  })

  it('does not paint a marker on a published page when `?draft=true` is absent (admin session)', async () => {
    adminFlag = true
    currentSession = adminSession()

    const result = unwrapLoaderData<LoaderResult>(
      await pageRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/about'),
          session: currentSession,
          params: { slug: 'about' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    // No catalog miss, no `?draft=true` → the service is not even
    // consulted on the warm path.
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })
})
