import { deletePostSchema } from '@/server/cms/posts/schema'
import { deletePost, loadOwnedPostOr404 } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deletePostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    const result = await deletePost(BigInt(payload.id))
    if (!result.deleted) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return { success: true } as const
  },
})
