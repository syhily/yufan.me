import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makeAuthedCtx } from './_helpers/mock-ctx'

// Stub bcrypt so tests stay sync-friendly and don't pay for key
// derivation. The controller only cares about boolean compare.
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed:new-password'),
  },
}))

vi.mock('@/server/db/query/user', () => ({
  findUserById: vi.fn(),
  updateUserById: vi.fn(),
}))

vi.mock('@/server/auth/session-storage', () => ({
  revokeAllSessionsOfUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/server/auth/sessions', () => ({
  findSessionMeta: vi.fn(),
  revokeSessionById: vi.fn().mockResolvedValue(true),
}))

const { findUserById, updateUserById } = await import('@/server/db/query/user')
const { revokeAllSessionsOfUser } = await import('@/server/auth/session-storage')
const { revokeSessionById } = await import('@/server/auth/sessions')
const { accountController } = await import('@/server/http/controllers/account.controller')

const dbUserStub = {
  id: 1n,
  name: 'Alice',
  email: 'alice@example.com',
  link: null,
  password: 'hashed:old-password',
  badgeName: null,
  badgeColor: null,
  badgeTextColor: null,
  role: 'visitor' as const,
  receiveEmail: true,
  emailVerified: true,
}

const updatedUserStub = {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  link: null,
  badgeName: null,
  badgeColor: null,
  badgeTextColor: null,
  role: 'visitor' as const,
  receiveEmail: true,
}

describe('accountController.updateProfile', () => {
  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(dbUserStub as never)
    vi.mocked(updateUserById).mockResolvedValue(updatedUserStub as never)
  })

  it('updates name when supplied and returns the projected user', async () => {
    const ctx = makeAuthedCtx({ userId: '1', role: 'visitor' })
    const res = await accountController.updateProfile({ body: { name: 'Alice the Updated' } } as never, ctx)
    expect(res.status).toBe(200)
    expect(vi.mocked(updateUserById)).toHaveBeenCalledWith(1n, expect.objectContaining({ name: 'Alice the Updated' }))
  })

  it('refuses to set badge fields for a non-admin visitor', async () => {
    const ctx = makeAuthedCtx({ userId: '1', role: 'visitor' })
    await accountController.updateProfile({ body: { badgeName: 'visitor-cannot-set' } } as never, ctx)
    const callPatch = vi.mocked(updateUserById).mock.calls.at(-1)?.[1]
    expect(callPatch).not.toHaveProperty('badgeName')
  })

  it('returns 404 when the underlying user row is missing', async () => {
    vi.mocked(findUserById).mockResolvedValueOnce(null)
    const ctx = makeAuthedCtx({ userId: '404' })
    const res = await accountController.updateProfile({ body: {} } as never, ctx)
    expect(res.status).toBe(404)
  })
})

describe('accountController.updatePassword', () => {
  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(dbUserStub as never)
    vi.mocked(updateUserById).mockResolvedValue(updatedUserStub as never)
  })

  it('hashes the new password, persists it, and revokes other sessions', async () => {
    const ctx = makeAuthedCtx({ userId: '1', sessionId: 'keep-me' })
    const res = await accountController.updatePassword(
      { body: { oldPassword: 'whatever', newPassword: 'new-password-1' } } as never,
      ctx,
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(updateUserById)).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ password: 'hashed:new-password' }),
    )
    expect(vi.mocked(revokeAllSessionsOfUser)).toHaveBeenCalledWith(1n, 'keep-me')
  })

  it('returns 403 when the original password does not match', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
    const ctx = makeAuthedCtx({ userId: '1' })
    const res = await accountController.updatePassword(
      { body: { oldPassword: 'wrong', newPassword: 'new-password-1' } } as never,
      ctx,
    )
    expect(res.status).toBe(403)
  })
})

describe('accountController.revokeSession', () => {
  it('returns 200 with `currentSession: false` when the revoked id is not the caller session', async () => {
    vi.mocked(revokeSessionById).mockResolvedValue(true as never)
    const ctx = makeAuthedCtx({ userId: '1', sessionId: 'caller-session' })
    const res = await accountController.revokeSession({ params: { id: 'other-session' } } as never, ctx)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, currentSession: false })
  })
})
