import { deletePostSchema } from '@/server/cms/posts/schema'
import { deletePost } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deletePostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const result = await deletePost(BigInt(payload.id), {
      userId: ctx.session.get('user')!.id,
      role: ctx.session.get('user')!.role!,
    })
    if (!result.deleted) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return { success: true } as const
  },
})
