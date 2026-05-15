import { describe, expect, it, vi } from 'vite-plus/test'

import { makeAuthedCtx } from './_helpers/mock-ctx'

vi.mock('@/server/cache/admin', () => ({
  clearAdminCache: vi.fn(),
  getAdminCacheStats: vi.fn(),
}))

const cacheMod = await import('@/server/cache/admin')
const { adminCacheController } = await import('@/server/http/controllers/admin/cache.controller')

const statsStub = {
  buckets: [
    {
      id: 'og',
      label: 'OG',
      description: '',
      prefix: 'og:',
      ttlSeconds: 600,
      pattern: 'og:*',
      keyCount: 3,
    },
  ],
  reserved: [],
  total: 3,
  generatedAt: new Date().toISOString(),
}

describe('adminCacheController.getStats', () => {
  it('proxies the service stats verbatim', async () => {
    vi.mocked(cacheMod.getAdminCacheStats).mockResolvedValueOnce(statsStub as never)
    const ctx = makeAuthedCtx()
    const res = await adminCacheController.getStats({ params: { id: 'og' }, query: {} } as never, ctx)
    expect(res.status).toBe(200)
    expect((res.body as { total: number }).total).toBe(3)
  })
})

describe('adminCacheController.clear', () => {
  it('forwards the target string to the service and ships the refreshed stats', async () => {
    vi.mocked(cacheMod.clearAdminCache).mockResolvedValueOnce({
      cleared: [{ bucketId: 'og', label: 'OG', removed: 2 }],
      total: 2,
      refreshedStats: statsStub,
    } as never)
    const ctx = makeAuthedCtx()
    const res = await adminCacheController.clear({ body: { target: 'og' } } as never, ctx)
    expect(res.status).toBe(200)
    expect(vi.mocked(cacheMod.clearAdminCache)).toHaveBeenCalledWith('og')
  })
})
