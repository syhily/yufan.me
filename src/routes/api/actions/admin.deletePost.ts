import { ContentCatalog } from '@/server/catalog'
import { deletePostSchema } from '@/server/cms/posts/schema'
import { deletePost } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deletePostSchema,
  requireAdmin: true,
  async run({ payload }) {
    const result = await deletePost(BigInt(payload.id))
    if (!result.deleted) {
      throw new ActionFailure(404, '文章不存在或已被删除。')
    }
    ContentCatalog.reset()
    return { success: true } as const
  },
})
