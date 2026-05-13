import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeLoaderArgs } from './_helpers/context'
import { jsonRequest } from './_helpers/request'
import { adminSession } from './_helpers/session'

// Covers RBAC-RECTIFICATION-PLAN §1.6 (O5).
//
// `admin.approveCommentDeletion` is the admin-side review for the
// owner-initiated delete-request flow. Its semantics are «approve OR
// reject a pending delete request», NOT «admin force-delete», and the
// route must enforce that distinction:
//
//   1. A missing comment yields `404 «评论不存在。»`.
//   2. A comment without a pending delete request yields
//      `409 «该评论没有待处理的删除申请。»` — otherwise this route would
//      collapse into a generic "delete anything" admin path and the
//      audit log would lie about the trigger.
//   3. `{ approve: true }` soft-deletes via `softDeleteCommentById`.
//   4. `{ approve: false }` clears the pending request via
//      `adminClearDeleteRequest`.

const session = { current: adminSession() }

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session.current),
    userSession: vi.fn((s) => s?.data?.user),
    commitSession: vi.fn(async () => 'blog_session=stub'),
    resolveSessionContext: vi.fn(async () => ({
      session: session.current,
      user: session.current?.data?.user,
      role: session.current?.data?.user?.role ?? null,
    })),
  }
})

const commentQueryMock = vi.hoisted(() => ({
  findCommentWithUserById: vi.fn(),
  softDeleteCommentById: vi.fn(async () => undefined),
  adminClearDeleteRequest: vi.fn(async () => undefined),
}))

vi.mock('@/server/db/query/comment', () => commentQueryMock)

const { action } = await import('@/routes/api/actions/admin.approveCommentDeletion')

beforeEach(() => {
  vi.clearAllMocks()
  session.current = adminSession()
})

function makeComment(deleteRequestedAt: Date | null) {
  return {
    id: 12n,
    userId: 999n,
    type: 'post',
    ownerId: 1n,
    deleteRequestedAt,
    deleteRequestedBy: deleteRequestedAt ? 999n : null,
    content: 'hi',
    body: null,
    deletedAt: null,
    deleteAt: null,
    rootId: null,
    rid: null,
    isVerified: true,
    isPending: false,
    isCollapsed: false,
    isPinned: false,
    voteUp: 0,
    voteDown: 0,
    ip: '',
    ua: '',
    name: 'someone',
    email: 'someone@example.com',
    emailVerified: null,
    link: null,
    badgeName: null,
    badgeColor: null,
    badgeTextColor: null,
    createAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('admin.approveCommentDeletion', () => {
  it('returns 404 when the target comment does not exist', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(null)
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '12', approve: true }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('评论不存在。')
    expect(commentQueryMock.softDeleteCommentById).not.toHaveBeenCalled()
    expect(commentQueryMock.adminClearDeleteRequest).not.toHaveBeenCalled()
  })

  it('returns 409 when the comment has no pending delete request', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeComment(null))
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '12', approve: true }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('该评论没有待处理的删除申请。')
    expect(commentQueryMock.softDeleteCommentById).not.toHaveBeenCalled()
    expect(commentQueryMock.adminClearDeleteRequest).not.toHaveBeenCalled()
  })

  it('soft-deletes the comment when approve: true and request is pending', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeComment(new Date()))
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '12', approve: true }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    expect(commentQueryMock.softDeleteCommentById).toHaveBeenCalledWith(12n)
    expect(commentQueryMock.adminClearDeleteRequest).not.toHaveBeenCalled()
  })

  it('clears the pending request when approve: false', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeComment(new Date()))
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '12', approve: false }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    expect(commentQueryMock.adminClearDeleteRequest).toHaveBeenCalledWith(12n)
    expect(commentQueryMock.softDeleteCommentById).not.toHaveBeenCalled()
  })
})
