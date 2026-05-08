import { getAdminCacheStats } from '@/server/cache/admin'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  requireAdmin: true,
  async run() {
    return await getAdminCacheStats()
  },
})
