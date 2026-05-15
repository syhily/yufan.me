import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminCacheContract } from '@/shared/contracts/admin/cache'

import { getAdminCacheStats, clearAdminCache } from '@/server/cache/admin'
import { ok } from '@/server/http/response'
import { body } from '@/server/http/ts-rest-adapter'

interface ClearCacheBody {
  target: string
}

export const adminCacheController: ContractImpl<typeof adminCacheContract> = {
  getStats: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const stats = await getAdminCacheStats()
    return ok(stats)
  },

  clear: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<ClearCacheBody>(args)
    const result = await clearAdminCache(b.target as Parameters<typeof clearAdminCache>[0])
    return ok(result)
  },
}
