import { call } from '@orpc/server'
import { describe, expect, it, vi } from 'vite-plus/test'

import { makeAuthedCtx } from './_helpers/mock-ctx'

vi.mock('@/server/infra/redis/admin-ops', () => ({
  clearAdminCache: vi.fn(),
  getAdminCacheStats: vi.fn(),
}))

const cacheMod = await import('@/server/infra/redis/admin-ops')
const { adminCacheRouter } = await import('@/server/http/controllers/admin/cache.controller')

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

describe('adminCacheRouter.getStats', () => {
  it('proxies the service stats verbatim', async () => {
    vi.mocked(cacheMod.getAdminCacheStats).mockResolvedValueOnce(statsStub as never)
    const ctx = makeAuthedCtx()
    const res = (await call(adminCacheRouter.getStats, {}, { context: ctx })) as { total: number }
    expect(res.total).toBe(3)
  })
})

describe('adminCacheRouter.clear', () => {
  it('forwards the target string to the service and ships the refreshed stats', async () => {
    vi.mocked(cacheMod.clearAdminCache).mockResolvedValueOnce({
      cleared: [{ bucketId: 'og', label: 'OG', removed: 2 }],
      total: 2,
      refreshedStats: statsStub,
    } as never)
    const ctx = makeAuthedCtx()
    await call(adminCacheRouter.clear, { target: 'og' }, { context: ctx })
    expect(vi.mocked(cacheMod.clearAdminCache)).toHaveBeenCalledWith('og')
  })
})
