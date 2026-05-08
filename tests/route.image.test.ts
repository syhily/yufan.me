import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vite-plus/test'

import { makePage, makePost } from './_helpers/catalog'

// Image routes (`/images/og/:slug.png` and `/images/avatars/:hash.png`) are
// part of the public surface (cached upstream + referenced from generated
// HTML / OG). We pin: 302 fallback for unknown slugs/hashes, the canonical
// PNG response, and the cache-control header that lets browsers reuse them.

const drawOpenGraphMock = vi.fn(async () => Buffer.from('mock-png'))
const loadBufferMock = vi.fn(async (_key: string, factory: () => Promise<Buffer>) => factory())

vi.mock('@/server/images/og', () => ({
  drawOpenGraph: drawOpenGraphMock,
}))

vi.mock('@/server/cache/image', () => ({
  loadBuffer: loadBufferMock,
}))

const samplePost = makePost({ slug: 'hello', title: 'Hello', summary: 'summary', cover: '/c.png' })
const samplePage = makePage({ slug: 'about', title: 'About', summary: '', cover: '/c.png' })

vi.mock('@/server/catalog', () => ({
  getCatalog: vi.fn(async () => ({
    getPost: vi.fn((slug: string) => (slug === 'hello' ? samplePost : undefined)),
    getPage: vi.fn((slug: string) => (slug === 'about' ? samplePage : undefined)),
  })),
}))

const { loader: ogLoader } = await import('@/routes/image.og')

describe('routes/image.og loader', () => {
  it('falls back (302 to /images/open-graph.png) when slug is empty', async () => {
    const res = await ogLoader({ params: {} } as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('open-graph.png')
  })

  it("falls back (302) when slug doesn't match any post or page", async () => {
    const res = await ogLoader({ params: { slug: 'missing' } } as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('open-graph.png')
  })

  it('returns the rendered OG PNG with the immutable cache header for a real post', async () => {
    drawOpenGraphMock.mockClear()
    loadBufferMock.mockClear()
    const res = await ogLoader({ params: { slug: 'hello' } } as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(drawOpenGraphMock).toHaveBeenCalled()
  })

  it('returns the rendered OG PNG for a page (uses page.title + fallback summary)', async () => {
    drawOpenGraphMock.mockClear()
    const res = await ogLoader({ params: { slug: 'about' } } as never)
    expect(res.status).toBe(200)
    expect(drawOpenGraphMock).toHaveBeenCalled()
  })
})

// Avatar route uses fetch + DB; do a single contract test for the empty-hash
// fallback case which is dependency-free.
const { loader: avatarLoader } = await import('@/routes/image.avatar')

describe('routes/image.avatar loader', () => {
  it('redirects to /images/default-avatar.png when hash is missing', async () => {
    const res = await avatarLoader({ params: {} } as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('default-avatar.png')
  })
})
