import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeLoaderArgs } from './_helpers/context'
import { jsonRequest } from './_helpers/request'
import { adminSession } from './_helpers/session'

// Covers RBAC-RECTIFICATION-PLAN §1.5 (O4).
//
// `admin.sendPasswordReset` lets an admin trigger a password-reset
// email on behalf of another user. The route enforces three invariants:
//
//   1. A missing target user yields `404 «用户不存在。»`.
//   2. A per-target rate-limit gate prevents one mailbox from being
//      carpet-bombed by a runaway admin (or stolen cookie):
//      `429 «该用户的重置邮件发送过于频繁，请稍后再试。»`.
//   3. The happy path issues a reset token, sends the mail and returns
//      `{ success: true }`.

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

const userQueryMock = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))
vi.mock('@/server/db/query/user', () => userQueryMock)

const tokenMock = vi.hoisted(() => ({
  issueResetToken: vi.fn(async () => ({ token: 'tok-test' })),
}))
vi.mock('@/server/auth/verification-tokens', () => tokenMock)

const senderMock = vi.hoisted(() => ({
  sendPasswordReset: vi.fn(async () => undefined),
}))
vi.mock('@/server/email/sender', () => senderMock)

const rateLimitMock = vi.hoisted(() => ({
  tryPasswordResetByTargetRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
}))
vi.mock('@/server/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/server/rate-limit')>('@/server/rate-limit')
  return {
    ...actual,
    tryPasswordResetByTargetRateLimit: rateLimitMock.tryPasswordResetByTargetRateLimit,
  }
})

const { action } = await import('@/routes/api/actions/admin.sendPasswordReset')

beforeEach(() => {
  vi.clearAllMocks()
  session.current = adminSession()
})

describe('admin.sendPasswordReset', () => {
  it('returns 404 when the target user does not exist', async () => {
    userQueryMock.findUserById.mockResolvedValueOnce(null)
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { userId: '99' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('用户不存在。')
    expect(rateLimitMock.tryPasswordResetByTargetRateLimit).not.toHaveBeenCalled()
    expect(senderMock.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('returns 429 when the per-target rate limit is exceeded', async () => {
    userQueryMock.findUserById.mockResolvedValueOnce({
      id: 7n,
      role: 'visitor',
      email: 'target@example.com',
      name: 'target',
    } as never)
    rateLimitMock.tryPasswordResetByTargetRateLimit.mockResolvedValueOnce({ count: 99, exceeded: true } as never)
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { userId: '7' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('该用户的重置邮件发送过于频繁，请稍后再试。')
    expect(senderMock.sendPasswordReset).not.toHaveBeenCalled()
    expect(tokenMock.issueResetToken).not.toHaveBeenCalled()
  })

  it('issues a reset token and sends the mail on the happy path', async () => {
    const target = { id: 7n, role: 'visitor', email: 'target@example.com', name: 'target' }
    userQueryMock.findUserById.mockResolvedValueOnce(target as never)
    rateLimitMock.tryPasswordResetByTargetRateLimit.mockResolvedValueOnce({ count: 1, exceeded: false } as never)
    const res = await action(
      makeLoaderArgs({
        request: jsonRequest('POST', { userId: '7' }),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { success: boolean } }
    expect(body.data.success).toBe(true)
    expect(tokenMock.issueResetToken).toHaveBeenCalledWith(7n)
    expect(senderMock.sendPasswordReset).toHaveBeenCalledTimes(1)
    expect(rateLimitMock.tryPasswordResetByTargetRateLimit).toHaveBeenCalledWith(7n)
  })
})
