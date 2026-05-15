import { describe, expect, it, vi } from 'vite-plus/test'

import type { HandlerContext } from '@/server/http/ts-rest-adapter'

const mockCtx: HandlerContext = {
  request: new Request('http://localhost'),
  session: { get: () => undefined, set: () => {}, unset: () => {}, id: 's1' } as any,
  viewer: null,
  clientAddress: '127.0.0.1',
}

vi.mock('@/server/comments/loader', () => ({
  loadComments: vi.fn(),
  parseComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn(),
  findAuthorAvatar: vi.fn(),
}))

vi.mock('@/server/comments/admin', () => ({
  updateComment: vi.fn(),
  updateOwnComment: vi.fn(),
}))

vi.mock('@/server/comments/likes', () => ({
  increaseLikes: vi.fn(),
  decreaseLikes: vi.fn(),
  queryLikes: vi.fn(),
}))

vi.mock('@/server/comments/token', () => ({
  appendCommentToken: vi.fn(),
  cleanupExpiredTokens: vi.fn(),
  issueCommentToken: vi.fn(),
  revokeCommentToken: vi.fn(),
  verifyCommentOwnership: vi.fn(),
}))

vi.mock('@/server/db/query/metric', () => ({
  findMetricByPublicId: vi.fn(),
}))

vi.mock('@/server/db/query/comment', () => ({
  findCommentWithUserById: vi.fn(),
  requestDeleteComment: vi.fn(),
  listMyComments: vi.fn(),
  countMyComments: vi.fn(),
}))

vi.mock('@/server/db/query/user', () => ({
  findUserIdByEmail: vi.fn(),
}))

vi.mock('@/server/rate-limit', () => ({
  tryCommentPostRateLimit: vi.fn().mockResolvedValue({ exceeded: false, count: 0 }),
  tryCommentPostRateLimitByEmail: vi.fn().mockResolvedValue({ exceeded: false, count: 0 }),
  tryLikeIncreaseRateLimit: vi.fn().mockResolvedValue({ exceeded: false, count: 0 }),
}))

vi.mock('@/server/session', () => ({
  issueCsrfToken: vi.fn().mockResolvedValue({ token: 'csrf-token', setCookie: 'csrf-cookie' }),
  userSession: vi.fn().mockReturnValue(undefined),
  validateRequestCsrf: vi.fn().mockResolvedValue([true]),
}))

vi.mock('@/shared/blog-config', () => ({
  requireBlogSettingsSection: vi.fn((section: string) => {
    if (section === 'siteIdentity') {
      return { website: 'https://test.com' }
    }
    return { comments: { size: 20, tokenTtlSeconds: 3600 } }
  }),
}))

vi.mock('@/server/cache/avatar', () => ({
  AvatarStatus: { HAVE_AVATAR: 'have', NO_AVATAR: 'no' },
  cacheAvatar: vi.fn(),
}))

describe('commentController', () => {
  describe('loadComments', () => {
    it('returns 404 for unknown page_key', async () => {
      const { findMetricByPublicId } = await import('@/server/db/query/metric')
      vi.mocked(findMetricByPublicId).mockResolvedValueOnce(null)
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.loadComments({ query: { page_key: 'unknown', offset: 0 } }, mockCtx)
      expect(result.status).toBe(404)
    })
  })

  describe('increaseLike', () => {
    it('returns 404 for unknown metric', async () => {
      const { findMetricByPublicId } = await import('@/server/db/query/metric')
      vi.mocked(findMetricByPublicId).mockResolvedValueOnce(null)
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.increaseLike({ body: { key: 'unknown' } }, mockCtx)
      expect(result.status).toBe(404)
    })

    it('returns 429 when rate limited', async () => {
      const { tryLikeIncreaseRateLimit } = await import('@/server/rate-limit')
      vi.mocked(tryLikeIncreaseRateLimit).mockResolvedValueOnce({ exceeded: true, count: 100 })
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.increaseLike({ body: { key: 'k' } }, mockCtx)
      expect(result.status).toBe(429)
    })
  })

  describe('findAvatar', () => {
    it('returns url for email', async () => {
      const { findUserIdByEmail } = await import('@/server/db/query/user')
      vi.mocked(findUserIdByEmail).mockResolvedValueOnce('123')
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.findAvatar({ body: { email: 'test@test.com' } }, mockCtx)
      expect(result.status).toBe(200)
    })
  })

  describe('updateOwn', () => {
    it('returns 401 for unauthenticated user', async () => {
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.updateOwn({ body: { rid: '1', body: {} } }, mockCtx)
      expect(result.status).toBe(401)
    })
  })
})
