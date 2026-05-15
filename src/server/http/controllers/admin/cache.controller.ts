import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { clearAdminCache } from '@/server/cache/admin'
import { getAdminCacheStats } from '@/server/cache/admin'
import { userSession } from '@/server/session'
import { adminCacheContract } from '@/shared/contracts/admin/cache'

export const adminCacheController: ContractImpl<typeof adminCacheContract> = {
  getCacheStats: async (args, ctx) => {
    const result = await getAdminCacheStats()
    return { status: 200 as const, body: result }
  },
  clearCache: async (args, ctx) => {
    const payload = args.body
    const result = await clearAdminCache(payload.target)
    return { status: 200 as const, body: result }
  },
}
