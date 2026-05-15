import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { clearAdminCache, getAdminCacheStats } from '@/server/cache/admin'
import { adminCacheContract } from '@/shared/contracts/admin/cache'

export const adminCacheController: AuthedContractImpl<typeof adminCacheContract> = {
  getStats: async (_args, _ctx) => {
    const result = await getAdminCacheStats()
    return { status: 200 as const, body: result }
  },
  clear: async (args, _ctx) => {
    const payload = args.body
    const result = await clearAdminCache(payload.target)
    return { status: 200 as const, body: result }
  },
}
