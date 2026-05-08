import { z } from 'zod'

import { adminProc } from '@/server/http/orpc-base'
import { clearAdminCache, getAdminCacheStats } from '@/server/infra/cache/admin'
import { adminCacheStatsDto, clearCacheResultDto } from '@/shared/contracts/cache'
import { CACHE_BUCKET_IDS } from '@/shared/types/cache'
const getStats = adminProc
  .route({ method: 'GET', path: '/admin/cache/get-stats' })
  .input(z.object({}))
  .output(adminCacheStatsDto)
  .handler(() => getAdminCacheStats())

const clear = adminProc
  .route({ method: 'POST', path: '/admin/cache/clear' })
  .input(z.object({ target: z.union([z.enum(CACHE_BUCKET_IDS), z.literal('all')]) }))
  .output(clearCacheResultDto)
  .handler(({ input }) => clearAdminCache(input.target))

export const adminCacheRouter = { getStats, clear }
