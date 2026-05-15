import { describe, expect, it, vi } from 'vite-plus/test'

import { makePublicCtx } from './_helpers/mock-ctx'

// `comment-public.controller` orchestrates many service modules; we
// mock only the slices the tested methods reach into.

vi.mock('@/server/rate-limit', () => ({
  tryLikeIncreaseRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  tryCommentPostRateLimit: vi.fn(),
  tryCommentPostRateLimitByEmail: vi.fn(),
}))

vi.mock('@/server/db/query/metric', () => ({
  findMetricByPublicId: vi.fn(),
}))

vi.mock('@/server/db/query/user', () => ({
  findUserIdByEmail: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/server/comments/likes', () => ({
  decreaseLikes: vi.fn(),
  increaseLikes: vi.fn().mockResolvedValue({ likes: 1, token: 't' }),
  queryLikes: vi.fn().mockResolvedValue(0),
  validateLikeToken: vi.fn(),
}))

vi.mock('@/server/comments/loader', () => ({
  loadComments: vi.fn(),
  parseComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn(),
}))

vi.mock('@/server/images/avatar-fetch', () => ({
  fetchQQAvatarImage: vi.fn(),
  isQQEmail: () => false,
}))

vi.mock('@/server/cache/avatar', () => ({
  AvatarStatus: { HAVE_AVATAR: 'have', NO_AVATAR: 'none' },
  cacheAvatar: vi.fn(),
}))

vi.mock('@/server/comments/token', () => ({
  appendCommentToken: vi.fn(),
  issueCommentToken: vi.fn(),
  verifyCommentOwnership: vi.fn().mockResolvedValue({ ok: false, cleaned: [] }),
}))

vi.mock('@/server/comments/admin', () => ({
  updateComment: vi.fn(),
  getCommentById: vi.fn(),
}))

vi.mock('@/server/db/query/comment', () => ({
  findCommentWithUserById: vi.fn(),
}))

vi.mock('@/server/auth/primitives', () => ({
  userSession: () => undefined,
}))

vi.mock('@/server/auth/csrf', () => ({
  issueCsrfToken: vi.fn().mockResolvedValue({ token: 'csrf-x', setCookie: 'csrf=...' }),
}))

vi.mock('@/shared/blog-config', () => ({
  requireBlogSettingsSection: (section: string) => {
    if (section === 'siteIdentity') {
      return { website: 'https://example.test' }
    }
    return { comments: { tokenTtlSeconds: 60, size: 10 } }
  },
}))

const rateLimitMod = await import('@/server/rate-limit')
const metricMod = await import('@/server/db/query/metric')
const loaderMod = await import('@/server/comments/loader')
const { commentPublicController } = await import('@/server/http/controllers/comment-public.controller')

describe('commentPublicController.increaseLike', () => {
  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    vi.mocked(rateLimitMod.tryLikeIncreaseRateLimit).mockResolvedValueOnce({ exceeded: true } as never)
    vi.mocked(metricMod.findMetricByPublicId).mockResolvedValue({ type: 'post', ownerId: 1n } as never)
    const ctx = makePublicCtx({ clientAddress: '1.2.3.4' })
    const res = await commentPublicController.increaseLike({ body: { key: 'pk-1' } } as never, ctx)
    expect(res.status).toBe(429)
  })
})

describe('commentPublicController.findAvatar', () => {
  it('returns the resolved avatar URL for non-QQ email', async () => {
    const ctx = makePublicCtx()
    const res = await commentPublicController.findAvatar({ body: { email: 'someone@example.com' } } as never, ctx)
    expect(res.status).toBe(200)
    expect((res.body as { avatar: string }).avatar).toMatch(/^https:\/\/example\.test\/images\/avatar\/.+\.png$/)
  })
})

describe('commentPublicController.loadComments', () => {
  it('returns 404 when the metric public_id has no matching target', async () => {
    vi.mocked(metricMod.findMetricByPublicId).mockResolvedValueOnce(null)
    const ctx = makePublicCtx()
    const res = await commentPublicController.loadComments({ query: { page_key: 'missing', offset: 0 } } as never, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the comment loader fails', async () => {
    vi.mocked(metricMod.findMetricByPublicId).mockResolvedValueOnce({ type: 'post', ownerId: 1n } as never)
    vi.mocked(loaderMod.loadComments).mockResolvedValueOnce(null)
    const ctx = makePublicCtx()
    const res = await commentPublicController.loadComments({ query: { page_key: 'pk-1', offset: 0 } } as never, ctx)
    expect(res.status).toBe(500)
  })
})
