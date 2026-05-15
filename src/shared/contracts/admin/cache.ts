import { z } from 'zod'

import { CACHE_BUCKET_IDS } from '@/shared/cache-types'
import { c } from '@/shared/contracts/_base'
import { adminCacheStatsDto, clearCacheResultDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

export const adminCacheContract = c.router(
  {
    getStats: {
      method: 'GET',
      path: '/admin/cache/stats/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      query: z.object({}),
      responses: { 200: adminCacheStatsDto, ...standardMutationErrors },
      summary: '管理后台：缓存桶统计',
    },
    clear: {
      method: 'POST',
      path: '/admin/cache/clear',
      body: z.object({ target: z.union([z.enum(CACHE_BUCKET_IDS), z.literal('all')]) }),
      responses: { 200: clearCacheResultDto, ...standardMutationErrors },
      summary: '管理后台：清空缓存桶',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
