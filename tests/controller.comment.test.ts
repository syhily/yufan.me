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
  getCommentById: vi.fn(),
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

vi.mock('@/shared/comment-token', () => ({
  parseCommentTokensCookie: vi.fn().mockReturnValue({}),
  serializeCommentTokensCookie: vi.fn().mockReturnValue('__comment_tokens=; Path=/; SameSite=Lax; Max-Age=0'),
}))

vi.mock('@/server/db/query/metric', () => ({
  findMetricByPublicId: vi.fn(),
}))

vi.mock('@/server/db/query/comment', () => ({
  findCommentWithUserById: vi.fn(),
  findCommentWithUserAndTarget: vi.fn(),
  findCommentsByIds: vi.fn(),
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

  describe('listMine', () => {
    it('falls back to __comment_tokens cookie for anonymous visitors', async () => {
      const cookieHeader =
        '__comment_tokens=%7B%22pk%22%3A%5B%7B%22token%22%3A%22t1%22%2C%22expiresAt%22%3A9999999999999%7D%5D%7D'
      const anonCtx: HandlerContext = {
        ...mockCtx,
        request: new Request('http://localhost/api/comment/listMine', {
          headers: { Cookie: cookieHeader },
        }),
      }
      const { parseCommentTokensCookie } = await import('@/shared/comment-token')
      const mockParsed = { pk: [{ token: 't1', expiresAt: 9999999999999 }] }
      vi.mocked(parseCommentTokensCookie).mockReturnValueOnce(mockParsed)

      const { cleanupExpiredTokens } = await import('@/server/comments/token')
      vi.mocked(cleanupExpiredTokens).mockResolvedValueOnce({
        cleaned: mockParsed,
        validEntries: [
          {
            token: 't1',
            payload: { commentId: '42', userId: '7', pageKey: 'pk', createdAt: Date.now() },
            expiresAt: 9999999999999,
          },
        ],
      })

      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.listMine({ query: { offset: 0 } }, anonCtx)

      // Must respond 200 (not 401) — anonymous visitors are allowed.
      expect(result.status).toBe(200)
      // Must refresh the __comment_tokens cookie to strip expired entries.
      expect(result.headers).toBeDefined()
      expect(result.headers!['Set-Cookie']).toContain('__comment_tokens')
      // Must parse the cookie header from the request.
      expect(parseCommentTokensCookie).toHaveBeenCalledWith(cookieHeader)
    })

    it('uses session user id when logged in', async () => {
      const { userSession } = await import('@/server/session')
      vi.mocked(userSession).mockReturnValueOnce({ id: '7', role: 'visitor' } as any)
      const { listMyComments, countMyComments } = await import('@/server/db/query/comment')
      vi.mocked(listMyComments).mockResolvedValueOnce([])
      vi.mocked(countMyComments).mockResolvedValueOnce(0)
      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.listMine({ query: { offset: 0 } }, mockCtx)
      expect(result.status).toBe(200)
      expect(listMyComments).toHaveBeenCalledWith(7n, 0, 20)
    })
  })

  describe('replyComment', () => {
    it('includes __comment_tokens in Set-Cookie for non-admin users', async () => {
      const { findMetricByPublicId } = await import('@/server/db/query/metric')
      vi.mocked(findMetricByPublicId).mockResolvedValueOnce({
        publicId: 'pk',
        type: 'post',
        ownerId: 1n,
      } as any)
      const { createComment } = await import('@/server/comments/loader')
      vi.mocked(createComment).mockResolvedValueOnce({
        id: 42n,
        userId: 7n,
        name: 'visitor',
        email: 'v@test.com',
        link: '',
        badgeName: null,
        badgeColor: null,
        badgeTextColor: null,
        emailVerified: false,
      } as any)
      const { issueCommentToken, appendCommentToken } = await import('@/server/comments/token')
      vi.mocked(issueCommentToken).mockResolvedValueOnce('token-uuid')
      vi.mocked(appendCommentToken).mockReturnValueOnce({
        pk: [{ token: 'token-uuid', expiresAt: 9999999999999 }],
      })
      const { serializeCommentTokensCookie } = await import('@/shared/comment-token')
      vi.mocked(serializeCommentTokensCookie).mockReturnValueOnce(
        '__comment_tokens=%7B%22pk%22%3A%5B%7D; Path=/; SameSite=Lax; Max-Age=0',
      )

      const { commentController } = await import('@/server/http/controllers/comment.controller')
      const result = await commentController.replyComment(
        {
          body: {
            page_key: 'pk',
            name: 'visitor',
            email: 'v@test.com',
            csrf: 'csrf-token',
            body: [],
          },
        },
        mockCtx,
      )

      expect(result.status).toBe(200)
      const setCookie = result.headers!['Set-Cookie']
      // Must contain both CSRF and comment-token cookies, comma-joined
      // so safeJson splits them into separate Set-Cookie headers.
      expect(setCookie).toContain('csrf-cookie')
      expect(setCookie).toContain('__comment_tokens')
      expect(setCookie).toContain(', ')
    })
  })

  describe('admin comments getRaw token access', () => {
    it('allows comment owner via __comment_tokens cookie', async () => {
      const cookieHeader =
        '__comment_tokens=%7B%22pk%22%3A%5B%7B%22token%22%3A%22t1%22%2C%22expiresAt%22%3A9999999999999%7D%5D%7D'
      const ownerCtx: HandlerContext = {
        ...mockCtx,
        request: new Request('http://localhost/api/admin/comments/42/raw', {
          headers: { Cookie: cookieHeader },
        }),
      }
      const { parseCommentTokensCookie } = await import('@/shared/comment-token')
      const mockParsed = { pk: [{ token: 't1', expiresAt: 9999999999999 }] }
      vi.mocked(parseCommentTokensCookie).mockReturnValueOnce(mockParsed)

      const { verifyCommentOwnership } = await import('@/server/comments/token')
      vi.mocked(verifyCommentOwnership).mockResolvedValueOnce({ ok: true, cleaned: mockParsed })

      const { getCommentById } = await import('@/server/comments/admin')
      vi.mocked(getCommentById).mockResolvedValueOnce({
        id: 42n,
        body: [],
        content: '',
        name: 'visitor',
        email: 'v@test.com',
        type: 'post',
        ownerId: 1n,
      } as any)

      const { findCommentWithUserAndTarget } = await import('@/server/db/query/comment')
      vi.mocked(findCommentWithUserAndTarget).mockResolvedValueOnce(null)

      const { adminCommentsController } = await import('@/server/http/controllers/admin/comments.controller')
      const result = await adminCommentsController.getRaw({ params: { id: '42' } }, ownerCtx)

      expect(result.status).toBe(200)
    })

    it('blocks anonymous visitor without valid token', async () => {
      const { verifyCommentOwnership } = await import('@/server/comments/token')
      vi.mocked(verifyCommentOwnership).mockResolvedValueOnce({ ok: false, cleaned: {} })

      const { adminCommentsController } = await import('@/server/http/controllers/admin/comments.controller')
      const result = await adminCommentsController.getRaw({ params: { id: '42' } }, mockCtx)

      expect(result.status).toBe(403)
    })

    it('still allows admin without token check', async () => {
      const adminCtx: HandlerContext = {
        ...mockCtx,
        viewer: { userId: '1', role: 'admin' },
      }
      const { getCommentById } = await import('@/server/comments/admin')
      vi.mocked(getCommentById).mockResolvedValueOnce({
        id: 42n,
        body: [],
        content: '',
        name: 'visitor',
        email: 'v@test.com',
        type: 'post',
        ownerId: 1n,
      } as any)
      const { findCommentWithUserAndTarget } = await import('@/server/db/query/comment')
      vi.mocked(findCommentWithUserAndTarget).mockResolvedValueOnce(null)

      const { adminCommentsController } = await import('@/server/http/controllers/admin/comments.controller')
      const result = await adminCommentsController.getRaw({ params: { id: '42' } }, adminCtx)

      expect(result.status).toBe(200)
    })
  })
})
