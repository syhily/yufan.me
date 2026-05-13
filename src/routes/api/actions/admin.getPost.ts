import { getPostSchema } from '@/server/cms/posts/schema'
import { getPostDetailForAdmin } from '@/server/cms/posts/service'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: getPostSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const detail = await getPostDetailForAdmin(BigInt(payload.id), viewer)
    if (detail === null) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return detail
  },
})
