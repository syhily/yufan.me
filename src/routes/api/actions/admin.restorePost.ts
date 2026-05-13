import { restorePostSchema } from '@/server/cms/posts/schema'
import { restorePost } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: restorePostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const result = await restorePost(BigInt(payload.id), {
      userId: ctx.session.get('user')!.id,
      role: ctx.session.get('user')!.role!,
    })
    if (!result.restored) {
      throw new ActionFailure(404, '文章不存在或未被删除。')
    }
    return { success: true } as const
  },
})
