import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/server/db/query/image', () => ({
  findImagesByStoragePaths: vi.fn(async () => []),
}))

const queryImageMock = await import('@/server/db/query/image')
const { clearImageEnhanceCache, loadImageThumbhash } = await import('@/server/images/render-enhance')

const NOW = new Date('2026-05-02T08:00:00Z')

beforeEach(() => {
  clearImageEnhanceCache()
  vi.mocked(queryImageMock.findImagesByStoragePaths).mockReset()
  vi.mocked(queryImageMock.findImagesByStoragePaths).mockResolvedValue([])
})

afterEach(() => {
  clearImageEnhanceCache()
})

describe('server/images/render-enhance — loadImageThumbhash', () => {
  it('returns null for empty src', async () => {
    expect(await loadImageThumbhash('')).toBeNull()
  })

  it('returns the row dimensions and thumbhash for a matched URL', async () => {
    vi.mocked(queryImageMock.findImagesByStoragePaths).mockResolvedValue([
      {
        id: 4n,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        storagePath: 'images/categories/coding.jpg',
        mimeType: 'image/jpeg',
        width: 1280,
        height: 425,
        byteSize: 0,
        thumbhash: 'cover-hash',
        uploaderId: null,
        note: null,
      },
    ])

    const result = await loadImageThumbhash('https://cat.yufan.me/images/categories/coding.jpg')
    expect(result).toEqual({ width: 1280, height: 425, thumbhash: 'cover-hash' })
  })

  it('returns null when the URL has no matching row', async () => {
    expect(await loadImageThumbhash('https://cat.yufan.me/images/no-such.jpg')).toBeNull()
  })
})
