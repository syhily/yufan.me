import { getAdminCacheStats } from '@/server/cache/admin'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  requireRole: 'admin',
  async run() {
    return await getAdminCacheStats()
  },
})
