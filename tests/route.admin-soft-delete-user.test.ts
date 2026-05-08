import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeLoaderArgs } from './_helpers/context'
import { adminSession } from './_helpers/session'

// Covers RBAC-RECTIFICATION-PLAN §1.9 (F11).
//
// `admin.softDeleteUser` is the most privilege-heavy mutation in the
// admin surface. The route enforces four invariants:
//
//   1. Self-deletion is rejected (`403 «不能删除自己。»`).
//   2. Deleting the last remaining admin is rejected
//      (`409 «不能删除唯一的管理员。»`) so the site can never be locked
//      out.
//   3. After a successful soft-delete the target's every session is
//      revoked via `revokeAllSessionsOfUser`, so a stolen cookie cannot
//      survive the privilege change.
//   4. The happy path — deleting a non-admin target when more than one
//      admin remains — returns `{ success: true }`.

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
  countAdmins: vi.fn(),
}))
vi.mock('@/server/db/query/user', () => userQueryMock)

const usersServiceMock = vi.hoisted(() => ({
  softDeleteAdminUser: vi.fn(async () => true),
}))
vi.mock('@/server/users/service', () => usersServiceMock)

const sessionStorageMock = vi.hoisted(() => ({
  revokeAllSessionsOfUser: vi.fn(async () => undefined),
}))
vi.mock('@/server/auth/session-storage', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/session-storage')>('@/server/auth/session-storage')
  return {
    ...actual,
    revokeAllSessionsOfUser: sessionStorageMock.revokeAllSessionsOfUser,
  }
})

const { action } = await import('@/routes/api/actions/admin.softDeleteUser')

beforeEach(() => {
  vi.clearAllMocks()
  session.current = adminSession()
})

function deleteRequest(userId: string): Request {
  return new Request('http://localhost/api/actions/admin/softDeleteUser', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ userId }),
  })
}

describe('admin.softDeleteUser', () => {
  it('rejects 403 «不能删除自己。» when admin attempts self-delete', async () => {
    // `adminSession()` yields user.id === '1', so userId: '1' is self.
    const res = await action(
      makeLoaderArgs({
        request: deleteRequest('1'),
        session: session.current,
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('不能删除自己。')
    expect(usersServiceMock.softDeleteAdminUser).not.toHaveBeenCalled()
    expect(sessionStorageMock.revokeAllSessionsOfUser).not.toHaveBeenCalled()
  })

  it('rejects 409 «不能删除唯一的管理员。» when target is admin and only one admin remains', async () => {
    userQueryMock.findUserById.mockResolvedValueOnce({ id: 5n, role: 'admin' } as never)
    userQueryMock.countAdmins.mockResolvedValueOnce(1)
    const res = await action(
      makeLoaderArgs({
        request: deleteRequest('5'),
        session: session.current,
      }),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('不能删除唯一的管理员。')
    expect(usersServiceMock.softDeleteAdminUser).not.toHaveBeenCalled()
  })

  it('revokes all sessions of the target after a successful soft-delete', async () => {
    userQueryMock.findUserById.mockResolvedValueOnce({ id: 7n, role: 'visitor' } as never)
    usersServiceMock.softDeleteAdminUser.mockResolvedValueOnce(true)
    const res = await action(
      makeLoaderArgs({
        request: deleteRequest('7'),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    expect(usersServiceMock.softDeleteAdminUser).toHaveBeenCalledWith(7n)
    expect(sessionStorageMock.revokeAllSessionsOfUser).toHaveBeenCalledWith(7n)
    const body = (await res.json()) as { data: { success: boolean } }
    expect(body.data.success).toBe(true)
  })

  it('allows deleting an admin target when more than one admin exists', async () => {
    userQueryMock.findUserById.mockResolvedValueOnce({ id: 9n, role: 'admin' } as never)
    userQueryMock.countAdmins.mockResolvedValueOnce(3)
    usersServiceMock.softDeleteAdminUser.mockResolvedValueOnce(true)
    const res = await action(
      makeLoaderArgs({
        request: deleteRequest('9'),
        session: session.current,
      }),
    )
    expect(res.status).toBe(200)
    expect(usersServiceMock.softDeleteAdminUser).toHaveBeenCalledWith(9n)
    expect(sessionStorageMock.revokeAllSessionsOfUser).toHaveBeenCalledWith(9n)
  })
})
