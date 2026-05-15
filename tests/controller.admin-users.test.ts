import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeAuthedCtx } from './_helpers/mock-ctx'

vi.mock('@/server/db/query/user', () => ({
  countAdmins: vi.fn().mockResolvedValue(2),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserById: vi.fn(),
  insertAuthor: vi.fn(),
  softDeleteUserById: vi.fn(),
  updateUserById: vi.fn(),
  updateUserRole: vi.fn(),
}))
vi.mock('@/server/users/service', () => ({
  bulkApproveCommentsForUser: vi.fn().mockResolvedValue(0),
  bulkDeleteCommentsForUser: vi.fn().mockResolvedValue(0),
  fetchAdminUserDto: vi.fn(),
  listUsersForAdmin: vi.fn(),
  muteAdminUser: vi.fn(),
  restoreAdminUser: vi.fn().mockResolvedValue(true),
  softDeleteAdminUser: vi.fn().mockResolvedValue(true),
  toAdminUserDto: (row: unknown) => row,
}))
vi.mock('@/server/auth/session-storage', () => ({
  revokeAllSessionsOfUser: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/server/auth/sessions', () => ({
  findSessionMeta: vi.fn(),
  revokeSessionById: vi.fn(),
}))
vi.mock('@/server/auth/verification-tokens', () => ({
  issueResetToken: vi.fn(),
  issueSetupToken: vi.fn(),
  revokeTokensFor: vi.fn(),
}))
vi.mock('@/server/email/sender', () => ({
  sendAuthorInvite: vi.fn(),
  sendPasswordReset: vi.fn(),
}))
vi.mock('@/server/rate-limit', () => ({
  tryInviteByEmailRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  tryInviteRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  tryPasswordResetByTargetRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
}))

const { adminUsersController } = await import('@/server/http/controllers/admin/users.controller')
const userQuery = await import('@/server/db/query/user')
const usersService = await import('@/server/users/service')

describe('adminUsersController.list', () => {
  it('passes query params through to the service and projects each row', async () => {
    vi.mocked(usersService.listUsersForAdmin).mockResolvedValueOnce({
      users: [{ id: '7', name: 'u' } as never],
      total: 1,
      hasMore: false,
    })
    const ctx = makeAuthedCtx()
    const res = await adminUsersController.list({ query: { offset: 0, limit: 20 } } as never, ctx)
    expect(res.status).toBe(200)
    expect((res.body as { total: number }).total).toBe(1)
  })
})

describe('adminUsersController.get', () => {
  it('returns 404 when the user dto is null', async () => {
    vi.mocked(usersService.fetchAdminUserDto).mockResolvedValueOnce(null)
    const ctx = makeAuthedCtx()
    const res = await adminUsersController.get({ params: { id: '999' } } as never, ctx)
    expect(res.status).toBe(404)
  })
})

describe('adminUsersController.softDelete', () => {
  beforeEach(() => {
    vi.mocked(userQuery.findUserById).mockResolvedValue({ id: 2n, role: 'visitor' } as never)
  })

  it('refuses with 403 when the viewer is the same user', async () => {
    const ctx = makeAuthedCtx({ userId: '5' })
    const res = await adminUsersController.softDelete({ params: { id: '5' } } as never, ctx)
    expect(res.status).toBe(403)
  })

  it('refuses with 409 when removing the last admin', async () => {
    vi.mocked(userQuery.findUserById).mockResolvedValueOnce({ id: 9n, role: 'admin' } as never)
    vi.mocked(userQuery.countAdmins).mockResolvedValueOnce(1)
    const ctx = makeAuthedCtx({ userId: '1' })
    const res = await adminUsersController.softDelete({ params: { id: '9' } } as never, ctx)
    expect(res.status).toBe(409)
  })

  it('returns 204 on successful deletion and revokes sessions', async () => {
    vi.mocked(userQuery.findUserById).mockResolvedValueOnce({ id: 9n, role: 'visitor' } as never)
    const ctx = makeAuthedCtx({ userId: '1' })
    const res = await adminUsersController.softDelete({ params: { id: '9' } } as never, ctx)
    expect(res.status).toBe(204)
    const sessionStorage = await import('@/server/auth/session-storage')
    expect(vi.mocked(sessionStorage.revokeAllSessionsOfUser)).toHaveBeenCalledWith(9n)
  })
})

describe('adminUsersController.update', () => {
  it('returns 404 when updateUserById yields null', async () => {
    vi.mocked(userQuery.updateUserById).mockResolvedValueOnce(null as never)
    const ctx = makeAuthedCtx()
    const res = await adminUsersController.update({ params: { id: '99' }, body: { name: 'X' } } as never, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 200 success on a successful patch', async () => {
    vi.mocked(userQuery.updateUserById).mockResolvedValueOnce({ id: '1', name: 'X' } as never)
    const ctx = makeAuthedCtx()
    const res = await adminUsersController.update({ params: { id: '1' }, body: { name: 'X' } } as never, ctx)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })
})
