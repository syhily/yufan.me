import { getPostSchema } from '@/server/cms/posts/schema'
import { getPostDetailForAdmin } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: getPostSchema,
  requireAdmin: true,
  async run({ payload }) {
    const detail = await getPostDetailForAdmin(BigInt(payload.id))
    if (detail === null) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return detail
  },
})
