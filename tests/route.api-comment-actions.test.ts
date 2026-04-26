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
  LIMIT_THRESHOLD: 5,
}))

vi.mock('@/server/db/query/user', () => ({
  hasAdmin: vi.fn(async () => false),
  insertAdmin: vi.fn(),
  updateUserById: vi.fn(async () => ({ id: 1n })),
}))

const userQuery = await import('@/server/db/query/user')

const { action: loadAllAction } = await import('@/routes/api/actions/comment.loadAll')
const { action: updateUserAction } = await import('@/routes/api/actions/auth.updateUser')

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
// `signInWithSession` / `signUpInitialAdminWithSession` flows lives in
// `route.wp-login.test.ts` (route action level).

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
