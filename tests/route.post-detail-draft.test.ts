import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PortableTextBody } from '@/shared/pt/schema'

import { makePost } from './_helpers/catalog'
import { makeLoaderArgs, unwrapLoaderData } from './_helpers/context'
import { adminSession, regularSession } from './_helpers/session'

// Draft-preview contract for `routes/post.detail`. Three states:
//
//   - `'unpublished-draft'`  — published post + `?draft=true` + a
//                              newer draft revision exists. Body
//                              swaps to the draft.
//   - `'published-draft'`    — published post + `?draft=true` but no
//                              newer draft. Body stays on the
//                              published revision; the badge confirms
//                              parity.
//
// Anonymous visitors (and non-admin sessions) are never allowed to
// trip these branches: `?draft=true` is silently ignored.

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

const publishedPost = {
  ...makePost({ slug: 'hello', title: 'Hello', permalink: '/posts/hello' }),
  body: publishedBody,
  imageSources: [],
  publishedRevisionId: 42n,
}

let currentSession = regularSession()

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => currentSession),
    isAdmin: vi.fn(() => (currentSession?.data?.user as { role?: string } | undefined)?.role === 'admin'),
    userSession: vi.fn((s: { data?: { user?: unknown } } | undefined) => s?.data?.user),
    resolveSessionContext: vi.fn(async () => ({
      session: currentSession,
      user: currentSession?.data?.user,
      role: (currentSession?.data?.user as { role?: string } | undefined)?.role ?? null,
    })),
  }
})

vi.mock('@/server/posts/query', () => ({
  findPostBySlug: vi.fn(async (slug: string) => (slug === 'hello' ? publishedPost : null)),
  selectSidebarPosts: vi.fn(async () => []),
}))

vi.mock('@/server/pages/query', () => ({
  findPageBySlug: vi.fn(async () => null),
}))

vi.mock('@/server/cms/posts/service', () => ({
  loadPostDraftPreviewBySlug: vi.fn(),
}))

vi.mock('@/server/catalog/queries', () => ({
  listAllFriends: vi.fn(async () => []),
  getTagsByNames: vi.fn(async () => []),
  listAllTags: vi.fn(async () => []),
}))

vi.mock('@/shared/catalog', async () => {
  const actual = await vi.importActual<typeof import('@/shared/catalog')>('@/shared/catalog')
  return {
    ...actual,
    toClientPost: (p: unknown) => p,
    toClientPage: (p: unknown) => p,
    toDetailPostShell: (p: unknown) => p,
  }
})

vi.mock('@/server/comments/page-data', () => ({
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

vi.mock('@/server/images/render-enhance', () => ({
  resolveImageMetaBySources: vi.fn(async () => new Map()),
}))

const postRoute = await import('@/routes/post.detail')
const postsService = await import('@/server/cms/posts/service')
const draftPreviewMock = vi.mocked(postsService.loadPostDraftPreviewBySlug)

type LoaderResult = {
  post: { title: string }
  body: PortableTextBody
  draftMarker: 'draft' | 'unpublished-draft' | 'published-draft' | null
}

beforeEach(() => {
  vi.clearAllMocks()
  currentSession = regularSession()
})

describe('routes/post.detail draft preview', () => {
  it('serves the published body without a marker for anonymous visitors', async () => {
    const result = unwrapLoaderData<LoaderResult>(
      await postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello'),
          session: currentSession,
          params: { slug: 'hello' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })

  it('ignores `?draft=true` for anonymous visitors on a published post', async () => {
    const result = unwrapLoaderData<LoaderResult>(
      await postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello?draft=true'),
          session: currentSession,
          params: { slug: 'hello' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })

  it('shows 【未发布的草稿】 for an admin opening a published post with `?draft=true` when a newer draft exists', async () => {
    currentSession = adminSession()
    draftPreviewMock.mockResolvedValueOnce({
      post: { ...publishedPost, body: draftBody },
      hasNewerDraft: true,
    })

    const result = unwrapLoaderData<LoaderResult>(
      await postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello?draft=true'),
          session: currentSession,
          params: { slug: 'hello' },
        }),
      ),
    )

    expect(result.body).toEqual(draftBody)
    expect(result.draftMarker).toBe('unpublished-draft')
  })

  it('shows 【已发布的草稿】 when an admin opens a published post with `?draft=true` and there is no newer draft', async () => {
    currentSession = adminSession()
    draftPreviewMock.mockResolvedValueOnce({
      post: publishedPost,
      hasNewerDraft: false,
    })

    const result = unwrapLoaderData<LoaderResult>(
      await postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello?draft=true'),
          session: currentSession,
          params: { slug: 'hello' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBe('published-draft')
  })

  it('does not paint a marker on a published post when `?draft=true` is absent (admin session)', async () => {
    currentSession = adminSession()

    const result = unwrapLoaderData<LoaderResult>(
      await postRoute.loader(
        makeLoaderArgs({
          request: new Request('http://localhost/posts/hello'),
          session: currentSession,
          params: { slug: 'hello' },
        }),
      ),
    )

    expect(result.body).toEqual(publishedBody)
    expect(result.draftMarker).toBeNull()
    expect(draftPreviewMock).not.toHaveBeenCalled()
  })
})
