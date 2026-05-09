import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { mockRedis } from './_helpers/redis'

vi.mock('@/server/db/query/image', () => ({
  findImagesByStoragePaths: vi.fn(async () => []),
}))

// Stand-in for the unstorage `storage` export so the render-enhance
// cache writes / reads round-trip through an in-memory map instead
// of trying to reach a real Redis. The helper already implements the
// `getItem`/`setItem`/`removeItem` surface this module needs.
const fakeStorage = mockRedis()
vi.mock('@/server/cache/storage', () => ({
  storage: fakeStorage,
  redisInstance: () => fakeStorage,
}))

const queryImageMock = await import('@/server/db/query/image')
const { clearImageEnhanceCache, loadImageThumbhash } = await import('@/server/images/render-enhance')
const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')
const { TEST_BLOG_SETTINGS_BUNDLE } = await import('./_helpers/blog-settings')

const NOW = new Date('2026-05-02T08:00:00Z')

beforeEach(async () => {
  setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
  fakeStorage.reset()
  await clearImageEnhanceCache()
  vi.mocked(queryImageMock.findImagesByStoragePaths).mockReset()
  vi.mocked(queryImageMock.findImagesByStoragePaths).mockResolvedValue([])
})

afterEach(async () => {
  await clearImageEnhanceCache()
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

    const result = await loadImageThumbhash('https://stage-asset.yufan.me/images/categories/coding.jpg')
    expect(result).toEqual({ width: 1280, height: 425, thumbhash: 'cover-hash' })
  })

  it('returns null when the URL has no matching row', async () => {
    expect(await loadImageThumbhash('https://stage-asset.yufan.me/images/no-such.jpg')).toBeNull()
  })

  it('serves a second hit from the Redis cache (no second DB call)', async () => {
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

    await loadImageThumbhash('https://stage-asset.yufan.me/images/categories/coding.jpg')
    await loadImageThumbhash('https://stage-asset.yufan.me/images/categories/coding.jpg')

    expect(vi.mocked(queryImageMock.findImagesByStoragePaths)).toHaveBeenCalledTimes(1)
  })
})
