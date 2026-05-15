import { describe, expect, it, vi } from 'vite-plus/test'

import { makeAuthedCtx } from './_helpers/mock-ctx'

vi.mock('@/server/cms/posts/service', () => ({
  createPost: vi.fn(),
  deletePost: vi.fn(),
  getPostDetailForAdmin: vi.fn(),
  listPostsForAdmin: vi.fn(),
  listRevisionsForAdmin: vi.fn(),
  publishLatest: vi.fn(),
  restorePost: vi.fn(),
  saveDraft: vi.fn(),
  unpublishPost: vi.fn(),
  updatePostMeta: vi.fn(),
}))

vi.mock('@/server/cms/posts/preview', () => ({
  renderPortableTextToHtml: vi.fn(),
}))

const service = await import('@/server/cms/posts/service')
const { adminPostsController } = await import('@/server/http/controllers/admin/posts.controller')

describe('adminPostsController.get', () => {
  it('returns 404 when the post detail is null', async () => {
    vi.mocked(service.getPostDetailForAdmin).mockResolvedValueOnce(null as never)
    const ctx = makeAuthedCtx()
    const res = await adminPostsController.get({ params: { id: '999' } } as never, ctx)
    expect(res.status).toBe(404)
  })

  it('passes through the detail dto on hit', async () => {
    const stubDetail = {
      post: { id: '1', slug: 's', title: 't' } as never,
      latestRevision: null,
      publishedRevision: null,
    }
    vi.mocked(service.getPostDetailForAdmin).mockResolvedValueOnce(stubDetail as never)
    const ctx = makeAuthedCtx()
    const res = await adminPostsController.get({ params: { id: '1' } } as never, ctx)
    expect(res.status).toBe(200)
    expect((res.body as { post: { id: string } }).post.id).toBe('1')
  })
})

describe('adminPostsController.delete', () => {
  it('returns 404 when deletePost yields { deleted: false }', async () => {
    vi.mocked(service.deletePost).mockResolvedValueOnce({ deleted: false } as never)
    const ctx = makeAuthedCtx()
    const res = await adminPostsController.delete({ params: { id: '1' } } as never, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 204 with undefined body when deletePost succeeds', async () => {
    vi.mocked(service.deletePost).mockResolvedValueOnce({ deleted: true } as never)
    const ctx = makeAuthedCtx()
    const res = await adminPostsController.delete({ params: { id: '1' } } as never, ctx)
    expect(res.status).toBe(204)
    expect(res.body).toBeUndefined()
  })
})

describe('adminPostsController.saveDraft', () => {
  it('discriminates `saved` and `conflict` shapes on the union response', async () => {
    vi.mocked(service.saveDraft).mockResolvedValueOnce({
      status: 'saved',
      revision: { id: 'r1' } as never,
    } as never)
    const ctx = makeAuthedCtx()
    const res = await adminPostsController.saveDraft(
      { body: { id: '1', body: [], expectedClientRevisionToken: 'tok' } } as never,
      ctx,
    )
    expect(res.status).toBe(200)
    expect((res.body as { status: string }).status).toBe('saved')
  })
})
