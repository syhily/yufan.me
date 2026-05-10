import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeLoaderArgs } from './_helpers/context'
import { jsonRequest } from './_helpers/request'
import { adminSession, regularSession } from './_helpers/session'

// End-to-end execution of representative Resource Routes through `runApi`.
// We mock the underlying domain services so the loaders/actions can run
// in isolation and we can assert the JSON envelope, status codes, and
// auth gating that downstream clients depend on.

const session = { current: regularSession() }

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session.current),
    isAdmin: vi.fn((s) => Boolean(s?.data?.user?.admin)),
    userSession: vi.fn((s) => s?.data?.user),
    commitSession: vi.fn(async () => 'blog_session=stub'),
    login: vi.fn(),
    resolveSessionContext: vi.fn(async () => ({
      session: session.current,
      user: session.current?.data?.user,
      admin: Boolean(session.current?.data?.user?.admin),
    })),
  }
})

const loadAllMock = vi.fn()
vi.mock('@/server/comments/admin', () => ({
  loadAllComments: loadAllMock,
  approveComment: vi.fn(),
  deleteComment: vi.fn(),
  getCommentById: vi.fn(),
  updateComment: vi.fn(),
  getPageOptions: vi.fn(),
  getCommentAuthors: vi.fn(),
}))
vi.mock('@/server/comments/loader', () => ({
  createComment: vi.fn(),
}))

vi.mock('@/services/comments/render.server', () => ({
  renderAdminCommentListHtml: vi.fn(() => '<ul></ul>'),
  renderCommentItemHtml: vi.fn(() => '<li>ok</li>'),
}))

vi.mock('@/server/rate-limit', () => ({
  tryRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
  tryCommentPostRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
  tryCommentPostRateLimitByEmail: vi.fn(async () => ({ count: 1, exceeded: false })),
  tryLikeIncreaseRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
}))

vi.mock('@/server/db/query/user', () => ({
  hasAdmin: vi.fn(async () => false),
  insertAdmin: vi.fn(),
  updateUserById: vi.fn(async () => ({ id: 1n })),
}))

vi.mock('@/server/comments/likes', () => ({
  increaseLikes: vi.fn(async () => ({ token: 'tok-test', likes: 1 })),
}))

// `permalinkKeySchema` validates the `key` against `buildPermalinkSet()`.
// The action tests want the schema to pass for our test fixture key
// without standing up the real catalog.
vi.mock('@/server/catalog', () => ({
  buildPermalinkSet: vi.fn(async () => new Set<string>(['/posts/hello/'])),
}))

const userQuery = await import('@/server/db/query/user')
const rateLimit = await import('@/server/rate-limit')
const likes = await import('@/server/comments/likes')

const { action: loadAllAction } = await import('@/routes/api/actions/comment.loadAll')
const { action: updateUserAction } = await import('@/routes/api/actions/auth.updateUser')
const { action: increaseLikeAction } = await import('@/routes/api/actions/comment.increaseLike')

beforeEach(() => {
  vi.clearAllMocks()
  loadAllMock.mockReset()
  session.current = regularSession()
})

describe('api/comment.loadAll action', () => {
  it('rejects non-admins with a 403 envelope', async () => {
    session.current = regularSession()
    const res = await loadAllAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { offset: 0, limit: 10 }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBeTruthy()
  })

  it('returns the JSON comments payload for admins', async () => {
    session.current = adminSession()
    loadAllMock.mockResolvedValue({ comments: [], total: 0, hasMore: false })
    const res = await loadAllAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { offset: 0, limit: 10 }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { comments: unknown[]; total: number; hasMore: boolean }
    }
    expect(body.data).toMatchObject({ comments: [], total: 0, hasMore: false })
  })

  it('returns a 405 envelope for the wrong HTTP method', async () => {
    session.current = adminSession()
    const res = await loadAllAction(
      makeLoaderArgs({
        request: new Request('http://localhost/api/c', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(405)
  })

  it('returns a 400 envelope when the input fails Zod validation', async () => {
    session.current = adminSession()
    const res = await loadAllAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { offset: -1, limit: 10 }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { message: string; issues?: unknown[] } }
    expect(Array.isArray(body.error.issues)).toBe(true)
  })
})

// `auth.signIn` / `auth.signUpAdmin` are no longer JSON resource routes:
// the WordPress login + install pages submit through React Router's
// `<Form>` directly to the route's `action`, exercising
// `processAuthFormSubmission` end-to-end. Coverage for the underlying
// `signInWithSession` / `signUpInitialAdminWithSession` /
// `seedInstallSettingsWithSession` flows lives in
// `service.auth-flow.test.ts` (helper level) and `route.wp-login.test.ts`
// (route action level).

describe('api/auth.updateUser action', () => {
  it('rejects non-admins with 403', async () => {
    session.current = regularSession()
    const res = await updateUserAction(
      makeLoaderArgs({
        request: jsonRequest('PATCH', { userId: '1', name: 'updated' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when the user doesn't exist", async () => {
    session.current = adminSession()
    vi.mocked(userQuery.updateUserById).mockResolvedValueOnce(null)
    const res = await updateUserAction(
      makeLoaderArgs({
        request: jsonRequest('PATCH', { userId: '999', name: 'updated' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns success: true for a valid admin update', async () => {
    session.current = adminSession()
    vi.mocked(userQuery.updateUserById).mockResolvedValueOnce({ id: 1n } as never)
    const res = await updateUserAction(
      makeLoaderArgs({
        request: jsonRequest('PATCH', {
          userId: '1',
          name: 'updated',
          link: 'https://example.com',
        }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { success: boolean } }
    expect(body.data.success).toBe(true)
  })

  it('rejects unsafe user links before they reach the database', async () => {
    session.current = adminSession()
    const res = await updateUserAction(
      makeLoaderArgs({
        request: jsonRequest('PATCH', { userId: '1', link: 'javascript:alert(1)' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(400)
    expect(userQuery.updateUserById).not.toHaveBeenCalled()
  })
})

// `comment.increaseLike` gates `increaseLikes` on the configurable
// per-IP rate limit. The mocks above default to `exceeded: false`
// (the happy path) so the bulk of the suite exercises a normal
// click; the "rate-limited" test forces `exceeded: true` to assert
// the 429 envelope and that NO `like` row was written.
describe('api/comment.increaseLike action', () => {
  it('writes the like and returns the new count when the IP is under the limit', async () => {
    session.current = regularSession()
    vi.mocked(rateLimit.tryLikeIncreaseRateLimit).mockResolvedValueOnce({ count: 1, exceeded: false })
    vi.mocked(likes.increaseLikes).mockResolvedValueOnce({ token: 'tok-1', likes: 7 })

    const res = await increaseLikeAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { key: '/posts/hello/' }),
        session: session.current,
        clientAddress: '203.0.113.10',
      }),
    )

    expect(res.status).toBe(200)
    expect(rateLimit.tryLikeIncreaseRateLimit).toHaveBeenCalledWith('203.0.113.10')
    expect(likes.increaseLikes).toHaveBeenCalledWith('/posts/hello/')
    const body = (await res.json()) as { data: { token: string; likes: number; key: string } }
    expect(body.data).toMatchObject({ token: 'tok-1', likes: 7, key: '/posts/hello/' })
  })

  it('returns 429 and never reaches the DB when the IP is rate-limited', async () => {
    session.current = regularSession()
    vi.mocked(rateLimit.tryLikeIncreaseRateLimit).mockResolvedValueOnce({ count: 31, exceeded: true })

    const res = await increaseLikeAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { key: '/posts/hello/' }),
        session: session.current,
        clientAddress: '203.0.113.10',
      }),
    )

    expect(res.status).toBe(429)
    expect(likes.increaseLikes).not.toHaveBeenCalled()
  })

  it('returns 405 for the wrong HTTP method without consulting the rate limiter', async () => {
    session.current = regularSession()
    const res = await increaseLikeAction(
      makeLoaderArgs({
        request: new Request('http://localhost/api/like', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }),
        session: session.current,
      }),
    )

    expect(res.status).toBe(405)
    expect(rateLimit.tryLikeIncreaseRateLimit).not.toHaveBeenCalled()
    expect(likes.increaseLikes).not.toHaveBeenCalled()
  })
})
