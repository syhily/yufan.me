import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeLoaderArgs } from './_helpers/context'
import { jsonRequest } from './_helpers/request'
import { adminSession, adminUser } from './_helpers/session'

// Covers RBAC-RECTIFICATION-PLAN §1.1.
//
// The «own-routes» (`comment.requestDeleteOwn`, `comment.cancelDeleteOwn`,
// `comment.updateOwn`) implement strict ownership via
// `isCommentOwner` — admins MUST NOT be able to act on someone else's
// comment through these endpoints. Admin-driven moderation flows live on
// the dedicated `admin.*` routes and follow a different audit trail.
//
// For each own-route we assert that an admin session whose `viewer.userId`
// differs from the comment's `userId` is rejected with `404 «资源不存在。»`
// — the catch-all "this row doesn't belong to you, so it doesn't exist
// for you" response shared by every own-route.

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

const commentQueryMock = {
  findCommentWithUserById: vi.fn(),
  requestDeleteComment: vi.fn(async () => undefined),
  clearDeleteRequest: vi.fn(async () => true),
  countApprovedRepliesOfComment: vi.fn(async () => 0),
}

vi.mock('@/server/db/query/comment', () => commentQueryMock)

vi.mock('@/server/comments/admin', () => ({
  updateComment: vi.fn(async () => undefined),
}))

const { action: requestDeleteOwnAction } = await import('@/routes/api/actions/comment.requestDeleteOwn')
const { action: cancelDeleteOwnAction } = await import('@/routes/api/actions/comment.cancelDeleteOwn')
const { action: updateOwnAction } = await import('@/routes/api/actions/comment.updateOwn')

function makeForeignComment(overrides: Partial<{ deleteRequestedAt: Date | null }> = {}) {
  return {
    id: 7n,
    userId: 999n,
    deleteAt: null,
    deletedAt: null,
    deleteRequestedAt: null,
    deleteRequestedBy: null,
    type: 'post',
    ownerId: 1n,
    content: 'hi',
    body: null,
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
    name: 'someone-else',
    email: 'someone@example.com',
    emailVerified: null,
    link: null,
    badgeName: null,
    badgeColor: null,
    badgeTextColor: null,
    createAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  session.current = adminSession()
})

describe('comment.requestDeleteOwn — strict ownership (admin bypass forbidden)', () => {
  it('rejects an admin acting on someone else’s comment with 404 «资源不存在。»', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeForeignComment())
    const res = await requestDeleteOwnAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '7' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('资源不存在。')
    expect(commentQueryMock.requestDeleteComment).not.toHaveBeenCalled()
  })

  it('lets the actual owner request deletion successfully', async () => {
    // Owner-session: SessionUser id === comment.userId.
    const ownerUser = adminUser({ id: '999', role: 'visitor' })
    session.current = {
      ...session.current,
      data: { user: ownerUser },
      get: (k: string) => (k === 'user' ? ownerUser : undefined),
    } as never

    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeForeignComment())
    const res = await requestDeleteOwnAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '7' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { success: boolean } }
    expect(body.data.success).toBe(true)
    expect(commentQueryMock.requestDeleteComment).toHaveBeenCalledWith(7n, 999n)
  })
})

describe('comment.cancelDeleteOwn — strict ownership (admin bypass forbidden)', () => {
  it('rejects an admin cancelling someone else’s deletion with 404 «资源不存在。»', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(
      makeForeignComment({ deleteRequestedAt: new Date() }),
    )
    const res = await cancelDeleteOwnAction(
      makeLoaderArgs({
        request: jsonRequest('POST', { commentId: '7' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('资源不存在。')
    expect(commentQueryMock.clearDeleteRequest).not.toHaveBeenCalled()
  })
})

describe('comment.updateOwn — strict ownership (admin bypass forbidden)', () => {
  it('rejects an admin editing someone else’s comment with 404 «资源不存在。»', async () => {
    commentQueryMock.findCommentWithUserById.mockResolvedValueOnce(makeForeignComment())
    const request = jsonRequest(
      'POST',
      // Minimal valid PortableText body — a single paragraph block.
      [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          children: [{ _type: 'span', _key: 's1', text: 'edited', marks: [] }],
          markDefs: [],
        },
      ],
      'http://localhost/api/actions/comment/updateOwn?commentId=7',
    )
    const res = await updateOwnAction(makeLoaderArgs({ request, session: session.current }))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('资源不存在。')
  })
})
