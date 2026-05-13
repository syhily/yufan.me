import { deletePostSchema } from '@/server/cms/posts/schema'
import { deletePost } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deletePostSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const result = await deletePost(BigInt(payload.id), viewer)
    if (!result.deleted) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    return { success: true } as const
  },
})
