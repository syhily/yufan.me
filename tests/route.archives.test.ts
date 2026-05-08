import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { makePost } from './_helpers/catalog'
import { emptySession } from './_helpers/session'

const mocks = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  getPosts: vi.fn(),
  getClientPosts: vi.fn(),
  getClientPostsWithMetadata: vi.fn(async (posts: unknown[]) => posts),
}))

const session = emptySession()

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    getRequestSession: vi.fn(async () => session),
    isAdmin: vi.fn(() => false),
    userSession: vi.fn(() => undefined),
  }
})

vi.mock('@/server/catalog', () => ({
  getCatalog: mocks.getCatalog,
  getClientPostsWithMetadata: mocks.getClientPostsWithMetadata,
  toClientPost: (post: unknown) => post,
  toListingPostCard: (post: unknown) => post,
}))

const { loader } = await import('@/routes/archives')

const visiblePost = makePost({ slug: 'visible-post' })
const hiddenPost = makePost({ slug: 'hidden-post', visible: false })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPosts.mockReturnValue([visiblePost, hiddenPost])
  mocks.getClientPosts.mockReturnValue([visiblePost, hiddenPost])
  mocks.getCatalog.mockResolvedValue({
    getPosts: mocks.getPosts,
    getClientPosts: mocks.getClientPosts,
  })
})

describe('routes/archives loader', () => {
  it('includes visible=false posts while still excluding scheduled posts', async () => {
    const result = (await loader({
      request: new Request('http://localhost/archives'),
    } as never)) as { resolvedPosts: Array<{ slug: string }> }

    expect(mocks.getClientPosts).toHaveBeenCalledWith({
      includeHidden: true,
      includeScheduled: false,
    })
    expect(result.resolvedPosts.map((post) => post.slug)).toEqual(['visible-post', 'hidden-post'])
  })
})
