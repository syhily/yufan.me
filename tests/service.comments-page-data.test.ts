import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { regularSession } from './_helpers/session'

// `loadDetailPageData` must fan out `loadComments`, `queryLikes`, and
// `loadSidebarData` in parallel — they're independent and each is
// individually slow. This test injects 50ms of artificial latency into all
// three paths and asserts the wall clock stays below ~100ms (≈ slowest
// dependency + scheduler jitter), which is impossible if any pair were
// serialised.

vi.mock('@/server/comments/loader', () => ({
  ensureCommentPage: vi.fn(async () => undefined),
  loadComments: vi.fn(),
  parseComments: vi.fn(async () => []),
}))
vi.mock('@/server/comments/likes', () => ({ queryLikes: vi.fn() }))
vi.mock('@/server/sidebar/load', () => ({ loadSidebarData: vi.fn() }))
vi.mock('@/server/metrics/batcher', () => ({ bumpPageView: vi.fn() }))

const commentLoader = await import('@/server/comments/loader')
const likes = await import('@/server/comments/likes')
const sidebar = await import('@/server/sidebar/load')
const { loadDetailPageData } = await import('@/server/comments/page-data')

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('services/comments/page-data — loadDetailPageData', () => {
  it('loadComments + queryLikes + loadSidebarData run in parallel (≤100ms wall clock for 50ms each)', async () => {
    vi.mocked(commentLoader.loadComments).mockImplementation(() =>
      delay({ count: 0, roots_count: 0, comments: [] }, 50),
    )
    vi.mocked(likes.queryLikes).mockImplementation(() => delay(0, 50))
    vi.mocked(sidebar.loadSidebarData).mockImplementation(() =>
      delay(
        {
          recentPosts: [],
          recentComments: [],
          pendingComments: [],
          tags: [],
          isAdmin: false,
        } as never,
        50,
      ),
    )

    const start = Date.now()
    await loadDetailPageData(regularSession(), '/posts/timing', 'T')
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('skips parseComments entirely when there are zero comments (short-circuit)', async () => {
    vi.mocked(commentLoader.loadComments).mockResolvedValue({
      count: 0,
      roots_count: 0,
      comments: [],
    })
    vi.mocked(likes.queryLikes).mockResolvedValue(0)
    vi.mocked(sidebar.loadSidebarData).mockResolvedValue({
      recentPosts: [],
      recentComments: [],
      pendingComments: [],
      tags: [],
      isAdmin: false,
    } as never)

    const result = await loadDetailPageData(regularSession(), '/posts/empty', 'E')

    expect(result.commentItems).toEqual([])
    expect(commentLoader.parseComments).not.toHaveBeenCalled()
  })

  it('ensures the page row once, then loads comments without a second upsert', async () => {
    vi.mocked(commentLoader.loadComments).mockResolvedValue({
      count: 0,
      roots_count: 0,
      comments: [],
    })
    vi.mocked(likes.queryLikes).mockResolvedValue(0)
    vi.mocked(sidebar.loadSidebarData).mockResolvedValue({
      recentPosts: [],
      recentComments: [],
      pendingComments: [],
      tags: [],
      isAdmin: false,
    } as never)

    await loadDetailPageData(regularSession(), '/posts/one-upsert', 'One upsert')

    expect(commentLoader.ensureCommentPage).toHaveBeenCalledOnce()
    expect(commentLoader.loadComments).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/\/posts\/one-upsert\/$/),
      'One upsert',
      0,
      { ensurePage: false },
    )
  })
})
