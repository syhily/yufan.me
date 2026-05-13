import { clearAdminCache } from '@/server/cache/admin'
import { clearCacheSchema } from '@/server/cache/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: clearCacheSchema,
  requireRole: 'admin',
  async run({ payload }) {
    return await clearAdminCache(payload.target)
  },
})
