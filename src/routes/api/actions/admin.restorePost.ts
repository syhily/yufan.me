import { restorePostSchema } from '@/server/cms/posts/schema'
import { restorePost } from '@/server/cms/posts/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: restorePostSchema,
  requireAdmin: true,
  async run({ payload }) {
    const result = await restorePost(BigInt(payload.id))
    if (!result.restored) {
      throw new ActionFailure(404, '文章不存在或未被删除。')
    }
    return { success: true } as const
  },
})
