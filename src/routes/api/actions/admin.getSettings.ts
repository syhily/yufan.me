import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { getAdminBlogSettings } from '@/server/settings/service'

export const loader = defineGuardedApiAction({
  method: 'GET',
  requireRole: 'admin',
  async run() {
    return await getAdminBlogSettings()
  },
})
