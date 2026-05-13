import { getPostSchema } from '@/server/cms/posts/schema'
import { getPostDetailForAdmin, loadOwnedPostOr404 } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: getPostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    const detail = await getPostDetailForAdmin(BigInt(payload.id))
    if (detail === null) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return detail
  },
})
