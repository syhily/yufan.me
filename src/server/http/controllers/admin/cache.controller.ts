import { z } from 'zod'

import { clearAdminCache, getAdminCacheStats } from '@/server/cache/admin'
import { adminProc } from '@/server/http/orpc-base'
import { CACHE_BUCKET_IDS } from '@/shared/cache-types'
import { adminCacheStatsDto, clearCacheResultDto } from '@/shared/contracts/_dtos'

const getStats = adminProc
  .input(z.object({}))
  .output(adminCacheStatsDto)
  .handler(() => getAdminCacheStats())

const clear = adminProc
  .input(z.object({ target: z.union([z.enum(CACHE_BUCKET_IDS), z.literal('all')]) }))
  .output(clearCacheResultDto)
  .handler(({ input }) => clearAdminCache(input.target))

export const adminCacheRouter = { getStats, clear }
