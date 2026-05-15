import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { Env } from '@/server/http/context'

import { onErrorHandler } from '@/server/http/errors'

// End-to-end permission matrix exercise. We mount the real
// `createApiApp()` inside a minimal Hono wrapper that pre-seeds the
// `session` / `viewer` / `clientAddress` request vars (the slots the
// session middleware would populate in production), then drive
// requests through `app.request(...)` so guards / mountContract /
// adapter all run end-to-end. Service-layer modules are stubbed
// because we only care about HTTP-perimeter behaviour here.

// Heavy SDK modules pulled in by admin controllers we don't actually
// hit in this suite. Stubbing prevents AWS SDK / S3 transitive
// ESM-resolution errors under Vitest.
vi.mock('@/server/images/s3-client', () => ({
  getS3Client: () => null,
  s3PutObject: vi.fn(),
  s3DeleteObject: vi.fn(),
  s3HeadObject: vi.fn(),
}))
vi.mock('@/server/images/storage', () => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  isAssetUploadEnabled: () => false,
}))
vi.mock('@/server/images/avatar-fetch', () => ({
  fetchQQAvatarImage: vi.fn().mockResolvedValue(null),
  isQQEmail: () => false,
}))
vi.mock('@/server/cache/avatar', () => ({
  AvatarStatus: { HAVE_AVATAR: 'have', NO_AVATAR: 'none' },
  cacheAvatar: vi.fn(),
}))

vi.mock('@/server/db/query/user', () => ({
  findUserById: vi.fn().mockResolvedValue({ id: 5n, role: 'visitor', name: 'A', email: 'a@a' }),
  findUserByEmail: vi.fn(),
  findUserIdByEmail: vi.fn().mockResolvedValue(null),
  countAdmins: vi.fn().mockResolvedValue(2),
  insertAuthor: vi.fn(),
  softDeleteUserById: vi.fn(),
  updateUserById: vi.fn(),
  updateUserRole: vi.fn(),
}))
vi.mock('@/server/users/service', () => ({
  bulkApproveCommentsForUser: vi.fn(),
  bulkDeleteCommentsForUser: vi.fn(),
  fetchAdminUserDto: vi.fn().mockResolvedValue({ id: '5', name: 'A' }),
  listUsersForAdmin: vi.fn().mockResolvedValue({ users: [], total: 0, hasMore: false }),
  muteAdminUser: vi.fn(),
  restoreAdminUser: vi.fn(),
  softDeleteAdminUser: vi.fn().mockResolvedValue(true),
  toAdminUserDto: (row: unknown) => row,
}))
vi.mock('@/server/auth/session-storage', () => ({
  revokeAllSessionsOfUser: vi.fn(),
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
  tryLikeIncreaseRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  tryCommentPostRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  tryCommentPostRateLimitByEmail: vi.fn().mockResolvedValue({ exceeded: false }),
}))
vi.mock('@/server/db/query/metric', () => ({
  findMetricByPublicId: vi.fn().mockResolvedValue({ type: 'post', ownerId: 1n }),
}))
vi.mock('@/server/comments/likes', () => ({
  increaseLikes: vi.fn().mockResolvedValue({ likes: 1, token: 't' }),
  decreaseLikes: vi.fn(),
  queryLikes: vi.fn().mockResolvedValue(0),
  validateLikeToken: vi.fn(),
}))
vi.mock('@/server/comments/loader', () => ({
  loadComments: vi.fn().mockResolvedValue({ comments: [], roots_count: 0 }),
  parseComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn().mockResolvedValue({ id: 'c1', userId: '1' }),
}))
vi.mock('@/server/comments/admin', () => ({
  updateComment: vi.fn(),
  getCommentById: vi.fn(),
}))
vi.mock('@/server/comments/token', () => ({
  appendCommentToken: vi.fn(),
  issueCommentToken: vi.fn().mockResolvedValue('comment-token'),
  verifyCommentOwnership: vi.fn(),
}))
vi.mock('@/shared/blog-config', () => ({
  requireBlogSettingsSection: () => ({
    website: 'https://example.test',
    comments: { tokenTtlSeconds: 60, size: 10 },
  }),
}))

// Mock the csrf primitives so we can drive header-based pass/fail
// without touching real cookies.
vi.mock('@/server/auth/csrf', () => ({
  validateRequestCsrf: async (_req: Request, token: string | undefined): Promise<[boolean, string]> => {
    if (token === 'csrf-good') {
      return [true, '']
    }
    return [false, 'bad']
  },
  clearCsrfCookie: async () => 'csrf=; Max-Age=0',
  issueCsrfToken: async () => ({ token: 'csrf-good', setCookie: 'csrf=csrf-good' }),
}))

const { createApiApp } = await import('@/server/http/app')

type Role = 'admin' | 'author' | 'visitor'

function mountTestApp(opts: { user?: { id: string; role: Role } } = {}): Hono<Env> {
  const wrapper = new Hono<Env>()
  wrapper.onError(onErrorHandler)
  wrapper.use(
    '*',
    createMiddleware<Env>(async (c, next) => {
      c.set('requestId', 'test-rid')
      c.set('clientAddress', '127.0.0.1')
      c.set('session', {
        id: 'sess-1',
        get: (key: string) => (key === 'user' && opts.user ? opts.user : undefined),
        set: () => undefined,
        unset: () => undefined,
        flash: () => undefined,
      } as never)
      c.set('viewer', null)
      c.set('sessionDirty', false)
      await next()
    }),
  )
  wrapper.route('/', createApiApp())
  return wrapper
}

describe('permission matrix (E2E)', () => {
  it('anonymous → /api/account/* returns 401', async () => {
    const app = mountTestApp()
    const res = await app.request('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-good' },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(401)
  })

  it('visitor → /api/admin/users returns 403 (not admin)', async () => {
    const app = mountTestApp({ user: { id: '2', role: 'visitor' } })
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(403)
  })

  it('admin → /api/admin/users returns 200', async () => {
    const app = mountTestApp({ user: { id: '1', role: 'admin' } })
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(200)
  })

  it('admin cannot soft-delete themselves (403)', async () => {
    const app = mountTestApp({ user: { id: '1', role: 'admin' } })
    const res = await app.request('/api/admin/users/1', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'csrf-good' },
    })
    expect(res.status).toBe(403)
  })

  it('public mutation without CSRF returns 403', async () => {
    const app = mountTestApp()
    const res = await app.request('/api/comment/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com' }),
    })
    expect(res.status).toBe(403)
  })

  it('public mutation with valid CSRF returns 200', async () => {
    const app = mountTestApp()
    const res = await app.request('/api/comment/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-good' },
      body: JSON.stringify({ email: 'x@example.com' }),
    })
    expect(res.status).toBe(200)
  })
})
