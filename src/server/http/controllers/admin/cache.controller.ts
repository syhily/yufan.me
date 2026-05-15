import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminCacheContract } from '@/shared/contracts/admin/cache'

import { getAdminCacheStats, clearAdminCache } from '@/server/cache/admin'

export const adminCacheController: ContractImpl<typeof adminCacheContract> = {
  getStats: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const stats = await getAdminCacheStats()
    return { status: 200, body: stats }
  },

  clear: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { target: string }
    const result = await clearAdminCache(body.target as Parameters<typeof clearAdminCache>[0])
    return { status: 200, body: result }
  },
}
