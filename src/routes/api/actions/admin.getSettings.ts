import { defineApiAction } from '@/server/route-helpers/api-handler'
import { getAdminBlogSettings } from '@/server/settings/service'

export const loader = defineApiAction({
  method: 'GET',
  requireAdmin: true,
  async run() {
    return await getAdminBlogSettings()
  },
})
