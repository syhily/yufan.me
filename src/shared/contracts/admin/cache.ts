import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'

const cacheBucketId = z.enum(['og', 'calendar', 'avatar', 'imageMeta', 'embeddingSearch', 'searchResult'])

const cacheBucketStats = z.object({
  id: cacheBucketId,
  label: z.string(),
  description: z.string(),
  prefix: z.string(),
  ttlSeconds: z.number(),
  pattern: z.string(),
  keyCount: z.number(),
})

const reservedCacheBucketStats = z.object({
  id: z.enum(['session', 'rateLimit']),
  label: z.string(),
  description: z.string(),
  prefix: z.string(),
  pattern: z.string(),
  keyCount: z.number(),
})

const adminCacheStatsDto = z.object({
  buckets: z.array(cacheBucketStats),
  reserved: z.array(reservedCacheBucketStats),
  total: z.number(),
  generatedAt: z.string(),
})

const clearCacheInput = z.object({
  target: z.union([cacheBucketId, z.literal('all')]),
})

const clearCacheResultDto = z.object({
  cleared: z.array(
    z.object({
      bucketId: cacheBucketId,
      label: z.string(),
      removed: z.number(),
    }),
  ),
  total: z.number(),
  refreshedStats: adminCacheStatsDto,
})

export const adminCacheContract = c.router(
  {
    getStats: {
      method: 'GET',
      path: '/admin/cache/stats',
      responses: {
        200: adminCacheStatsDto,
        ...standardReadErrors,
      },
      summary: '管理后台：缓存统计',
    },
    clear: {
      method: 'POST',
      path: '/admin/cache/clear',
      body: clearCacheInput,
      responses: {
        200: clearCacheResultDto,
        ...standardMutationErrors,
      },
      summary: '管理后台：清除缓存',
    },
  },
  { strictStatusCodes: true },
)
