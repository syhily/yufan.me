import { z } from 'zod'

import type { AdminCacheStatsDto, ClearCacheResultDto } from '@/shared/cache-types'

import { CACHE_BUCKET_IDS } from '@/shared/cache-types'
import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

export const adminCacheContract = c.router(
  {
    getCacheStats: {
      method: 'GET',
      path: '/admin/get-cache-stats/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      query: z.object({}),
      responses: { 200: z.custom<AdminCacheStatsDto>(), ...standardMutationErrors },
      summary: 'getCacheStats',
    },
    clearCache: {
      method: 'POST',
      path: '/admin/clear-cache',
      body: z.object({ target: z.union([z.enum(CACHE_BUCKET_IDS), z.literal('all')]) }),
      responses: { 200: z.custom<ClearCacheResultDto>(), ...standardMutationErrors },
      summary: 'clearCache',
    },
  },
  { strictStatusCodes: true },
)
