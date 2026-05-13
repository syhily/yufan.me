import { getPostSchema } from '@/server/cms/posts/schema'
import { getPostDetailForAdmin } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: getPostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const detail = await getPostDetailForAdmin(BigInt(payload.id), {
      userId: ctx.session.get('user')!.id,
      role: ctx.session.get('user')!.role!,
    })
    if (detail === null) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return detail
  },
})
