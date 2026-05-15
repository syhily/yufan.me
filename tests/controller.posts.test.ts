import { describe, expect, it, vi } from 'vite-plus/test'

import type { HandlerContext } from '@/server/http/ts-rest-adapter'

const mockCtx: HandlerContext = {
  request: new Request('http://localhost'),
  session: {
    get: () => ({ id: '1', name: 'Test', email: 'a@b.com', website: null, role: 'admin' as const }),
    set: () => {},
    unset: () => {},
    id: 's1',
  } as any,
  viewer: { userId: '1', role: 'admin' as const },
  clientAddress: '127.0.0.1',
}

vi.mock('@/server/cms/posts/service', () => ({
  listPostsForAdmin: vi.fn().mockResolvedValue({ posts: [], total: 0, hasMore: false }),
  getPostDetailForAdmin: vi.fn(),
  createPost: vi.fn(),
  updatePostMeta: vi.fn(),
  deletePost: vi.fn(),
  restorePost: vi.fn(),
  listRevisionsForAdmin: vi.fn(),
  saveDraft: vi.fn(),
  publishLatest: vi.fn(),
  unpublishPost: vi.fn(),
}))

vi.mock('@/server/cms/posts/preview', () => ({ renderPortableTextToHtml: vi.fn().mockResolvedValue('<p>test</p>') }))

describe('adminPostsController', () => {
  it('list returns 200 with posts array', async () => {
    const { adminPostsController } = await import('@/server/http/controllers/admin/posts.controller')
    const result = await adminPostsController.list({ query: {} }, mockCtx)
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('posts')
  })

  it('get returns 404 for null detail', async () => {
    vi.mocked((await import('@/server/cms/posts/service')).getPostDetailForAdmin).mockResolvedValueOnce(null as any)
    const { adminPostsController } = await import('@/server/http/controllers/admin/posts.controller')
    const result = await adminPostsController.get({ params: { id: '999' } }, mockCtx)
    expect(result.status).toBe(404)
  })

  it('preview returns 200 with html and headings', async () => {
    const { adminPostsController } = await import('@/server/http/controllers/admin/posts.controller')
    const result = await adminPostsController.preview({ body: { body: [] as any } }, mockCtx)
    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('html')
    expect(result.body).toHaveProperty('headings')
  })
})
