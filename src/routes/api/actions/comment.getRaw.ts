import { getCommentById } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

export const loader = defineApiAction({
  method: 'GET',
  input: commentRidSchema,
  requireAdmin: true,
  async run({ payload }) {
    const comment = await getCommentById(payload.rid)
    if (!comment) {
      throw new ActionFailure(404, '评论不存在')
    }
    return { content: comment.content }
  },
})
