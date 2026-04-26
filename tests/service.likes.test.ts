import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/server/db/query/like', () => ({
  recordLikeAndCount: vi.fn(async () => 0),
  existsActiveLikeToken: vi.fn(),
  consumeActiveLikeToken: vi.fn(),
  pageVoteUp: vi.fn(),
  pageMetricsByKeys: vi.fn(),
  commentCountsByPageKeys: vi.fn(),
  purgeOldLikeTokens: vi.fn(async () => undefined),
}))

vi.mock('@/server/db/query/page', () => ({
  decrementPageVotes: vi.fn(async () => undefined),
}))

const likeQueries = await import('@/server/db/query/like')
const pageQueries = await import('@/server/db/query/page')
const { increaseLikes, decreaseLikes, purgeStaleLikeTokens, queryLikes, queryMetadata, validateLikeToken } =
  await import('@/server/comments/likes')

beforeEach(() => {
  for (const fn of Object.values({ ...likeQueries, ...pageQueries })) {
    if (typeof fn === 'function' && 'mockReset' in fn) {
      ;(fn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
})

describe('services/comments/likes — increaseLikes', () => {
  it('inserts a unique base64url token and reads the post-update count atomically', async () => {
    vi.mocked(likeQueries.recordLikeAndCount).mockResolvedValue(7)

    const result = await increaseLikes('/posts/hello')

    // Single round-trip — the transactional helper owns insert + bump + read.
    expect(likeQueries.recordLikeAndCount).toHaveBeenCalledOnce()
    // token is base64url-shaped (urlsafe alphabet, no padding) and 64 chars
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{64}$/)
    expect(result.likes).toBe(7)
    // The token and the page-counter key derive from the same permalink —
    // pin that they're written together (one call, both args present).
    const [insertedToken, insertedKey] = vi.mocked(likeQueries.recordLikeAndCount).mock.calls[0]
    expect(insertedToken).toBe(result.token)
    expect(insertedKey.endsWith('/')).toBe(true)
  })

  it('each call yields a fresh token (no token reuse / collision)', async () => {
    vi.mocked(likeQueries.recordLikeAndCount).mockResolvedValue(0)
    const a = await increaseLikes('/posts/x')
    const b = await increaseLikes('/posts/x')
    expect(a.token).not.toBe(b.token)
  })
})

describe('services/comments/likes — decreaseLikes', () => {
  it("no-ops when the token doesn't exist (anonymous undo of someone else's like)", async () => {
    vi.mocked(likeQueries.consumeActiveLikeToken).mockResolvedValue(false)

    await decreaseLikes('/posts/hello', 'stale-token')

    expect(likeQueries.consumeActiveLikeToken).toHaveBeenCalledWith(
      expect.stringMatching(/\/posts\/hello\/$/),
      'stale-token',
    )
    expect(pageQueries.decrementPageVotes).not.toHaveBeenCalled()
  })

  it('decrements the page counter only when the token is consumed', async () => {
    vi.mocked(likeQueries.consumeActiveLikeToken).mockResolvedValue(true)

    await decreaseLikes('/posts/hello', 'good-token')

    expect(likeQueries.consumeActiveLikeToken).toHaveBeenCalledWith(
      expect.stringMatching(/\/posts\/hello\/$/),
      'good-token',
    )
    expect(pageQueries.decrementPageVotes).toHaveBeenCalledOnce()
  })
})

describe('services/comments/likes — queryLikes', () => {
  it('delegates to pageVoteUp with the canonical page key', async () => {
    vi.mocked(likeQueries.pageVoteUp).mockResolvedValue(11)

    const count = await queryLikes('/posts/hello')

    expect(count).toBe(11)
    expect(likeQueries.pageVoteUp).toHaveBeenCalledOnce()
    const key = vi.mocked(likeQueries.pageVoteUp).mock.calls[0][0]
    // The key always ends with a trailing "/" — pin that contract since
    // existing rows in production rely on it.
    expect(key.endsWith('/')).toBe(true)
  })
})

describe('services/comments/likes — queryMetadata', () => {
  it('returns an empty Map for an empty permalink list (no DB roundtrip)', async () => {
    const result = await queryMetadata([], { likes: true, views: true, comments: true })

    expect(result.size).toBe(0)
    expect(likeQueries.pageMetricsByKeys).not.toHaveBeenCalled()
    expect(likeQueries.commentCountsByPageKeys).not.toHaveBeenCalled()
  })

  it('aggregates likes/views/comments per permalink, defaulting missing rows to 0', async () => {
    vi.mocked(likeQueries.pageMetricsByKeys).mockResolvedValue([
      { key: 'https://yufan.me/posts/a/', like: 5, view: 100 },
      // /posts/b has zero metrics — we still include it in the result map.
    ])
    vi.mocked(likeQueries.commentCountsByPageKeys).mockResolvedValue([
      { pageKey: 'https://yufan.me/posts/a/', count: 3 },
    ])

    const result = await queryMetadata(['/posts/a', '/posts/b'], {
      likes: true,
      views: true,
      comments: true,
    })

    expect(result.size).toBe(2)
    expect(result.get('/posts/a')).toEqual({ likes: 5, views: 100, comments: 3 })
    expect(result.get('/posts/b')).toEqual({ likes: 0, views: 0, comments: 0 })
  })

  it('skips the comment-count query when comments=false (perf knob)', async () => {
    vi.mocked(likeQueries.pageMetricsByKeys).mockResolvedValue([])

    await queryMetadata(['/posts/a'], { likes: true, views: true, comments: false })

    expect(likeQueries.commentCountsByPageKeys).not.toHaveBeenCalled()
  })
})

describe('services/comments/likes — validateLikeToken', () => {
  it('returns true iff the active token row exists in the DB', async () => {
    vi.mocked(likeQueries.existsActiveLikeToken).mockResolvedValueOnce(true)
    expect(await validateLikeToken('/posts/x', 'tok')).toBe(true)
    vi.mocked(likeQueries.existsActiveLikeToken).mockResolvedValueOnce(false)
    expect(await validateLikeToken('/posts/x', 'tok')).toBe(false)
  })

  it('validates against active tokens so soft-deleted rows do not keep the button liked', async () => {
    vi.mocked(likeQueries.existsActiveLikeToken).mockResolvedValue(false)

    await validateLikeToken('/posts/x', 'deleted-token')

    expect(likeQueries.existsActiveLikeToken).toHaveBeenCalledOnce()
    expect(likeQueries.existsActiveLikeToken).toHaveBeenCalledWith(
      expect.stringMatching(/\/posts\/x\/$/),
      'deleted-token',
    )
  })

  it('does not invoke the purge sweep on the validation hot path', async () => {
    // The previous implementation ran a 1% probabilistic table-wide
    // purge per validate call. The sweep now lives behind a guarded
    // `setInterval`, so the validate hot path must stay query-only.
    vi.mocked(likeQueries.existsActiveLikeToken).mockResolvedValue(true)
    await validateLikeToken('/posts/x', 'tok')
    expect(likeQueries.purgeOldLikeTokens).not.toHaveBeenCalled()
  })
})

describe('services/comments/likes — purgeStaleLikeTokens', () => {
  it('delegates the soft-deleted token cutoff to the query layer', async () => {
    await purgeStaleLikeTokens()

    expect(likeQueries.purgeOldLikeTokens).toHaveBeenCalledOnce()
    expect(vi.mocked(likeQueries.purgeOldLikeTokens).mock.calls[0][0]).toBeInstanceOf(Date)
  })
})
