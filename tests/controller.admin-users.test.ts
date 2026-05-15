import { describe, expect, it } from 'vite-plus/test'

import { adminUsersController } from '@/server/http/controllers/admin/users.controller'

// Controller unit tests — §9.2 of the Hono migration plan.
// Controllers are plain objects; unit tests are cheap and verify
// handler shapes without requiring a running server.

describe('adminUsersController', () => {
  const adminCtx = {
    request: new Request('http://localhost'),
    session: { get: () => undefined, set: () => {}, unset: () => {}, id: '' } as any,
    viewer: { userId: '1', role: 'admin' as const },
    clientAddress: '127.0.0.1',
  }

  it('list returns 200 with users array', async () => {
    const result = await adminUsersController.list(
      { query: { offset: 0, limit: 20, role: 'all', sortBy: 'recent', includeDeleted: false } },
      adminCtx,
    )
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('users')
    expect(result.body).toHaveProperty('total')
    expect(result.body).toHaveProperty('hasMore')
  })

  it('get returns 404 for non-existent user', async () => {
    const result = await adminUsersController.get({ params: { id: '999999999' } }, adminCtx)
    expect(result.status).toBe(404)
    expect(result.body).toHaveProperty('error')
  })

  it('softDelete returns 403 when deleting self', async () => {
    const result = await adminUsersController.softDelete({ params: { id: '1' } }, adminCtx)
    expect(result.status).toBe(403)
  })

  it('every declared endpoint has a handler function', () => {
    const handlers = Object.keys(adminUsersController)
    expect(handlers.length).toBeGreaterThanOrEqual(8)
    for (const key of handlers) {
      expect(typeof (adminUsersController as Record<string, unknown>)[key]).toBe('function')
    }
  })
})
