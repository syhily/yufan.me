import { getAdminCacheStats } from '@/server/cache/admin'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  requireRole: 'admin',
  async run() {
    return await getAdminCacheStats()
  },
})
