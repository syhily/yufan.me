import { getPageSchema } from '@/server/cms/pages/schema'
import { getPageDetailForAdmin } from '@/server/cms/pages/service'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'

// Loader (GET) so the editor can hit `?id=…` directly, no body. Returns
// the joined "page + latest + published" detail DTO. 404 when the row
// is missing or soft-deleted (the editor route translates that into a
// "create new" affordance instead of crashing).
export const loader = defineGuardedApiAction({
  method: 'GET',
  input: getPageSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const detail = await getPageDetailForAdmin(BigInt(payload.id))
    if (detail === null) {
      throw new ActionFailure(404, '页面不存在或已被删除。')
    }
    return detail
  },
})
