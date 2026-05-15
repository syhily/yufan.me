import { describe, expect, it, vi } from 'vite-plus/test'

import type { HandlerContext } from '@/server/http/ts-rest-adapter'

const mockCtx: HandlerContext = {
  request: new Request('http://localhost'),
  session: {
    get: () => ({ id: '1', name: 'Test', email: 'test@test.com', website: null, role: 'admin' as const }),
    set: () => {},
    unset: () => {},
    id: 's1',
  } as any,
  viewer: { userId: '1', role: 'admin' as const },
  clientAddress: '127.0.0.1',
}

vi.mock('@/server/db/query/user', () => ({
  findUserById: vi.fn().mockResolvedValue({
    id: BigInt(1),
    name: 'Test',
    email: 'test@test.com',
    password: 'hash',
    link: null,
    role: 'admin',
  }),
  updateUserById: vi.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
}))

vi.mock('@/server/auth/session-storage', () => ({ revokeAllSessionsOfUser: vi.fn() }))
vi.mock('@/server/auth/sessions', () => ({ findSessionMeta: vi.fn(), revokeSessionById: vi.fn() }))

describe('accountController', () => {
  it('updateProfile returns 200 for valid input', async () => {
    const { accountController } = await import('@/server/http/controllers/account.controller')
    const result = await accountController.updateProfile({ body: { name: 'New Name' } }, mockCtx)
    expect(result.status).toBe(200)
  })

  it('updatePassword returns 404 for non-existent user', async () => {
    const userModule = await import('@/server/db/query/user')
    vi.mocked(userModule.findUserById).mockResolvedValueOnce(null as any)
    const { accountController } = await import('@/server/http/controllers/account.controller')
    const result = await accountController.updatePassword(
      { body: { oldPassword: 'old', newPassword: 'new123456' } },
      mockCtx,
    )
    expect(result.status).toBe(404)
  })

  it('revokeSession returns 200 for already-revoked session', async () => {
    const sessionsModule = await import('@/server/auth/sessions')
    vi.mocked(sessionsModule.findSessionMeta).mockResolvedValueOnce(null)
    const { accountController } = await import('@/server/http/controllers/account.controller')
    const result = await accountController.revokeSession({ body: { sessionId: 'gone' } }, mockCtx)
    expect(result.status).toBe(200)
  })
})
