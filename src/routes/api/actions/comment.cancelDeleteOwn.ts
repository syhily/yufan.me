import { z } from 'zod'

import { clearDeleteRequest, findCommentWithUserById } from '@/server/db/query/comment'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const cancelDeleteOwnCommentSchema = z.object({
  commentId: z.string().min(1),
})

export const action = defineApiAction({
  method: 'POST',
  input: cancelDeleteOwnCommentSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const commentId = BigInt(payload.commentId)
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')

    const comment = await findCommentWithUserById(commentId)
    if (comment === null || comment.userId !== userId) {
      throw new ActionFailure(404, '评论不存在。')
    }

    // Only allow cancellation if the comment hasn't been soft-deleted by admin.
    if (comment.deleteRequestedAt === null) {
      throw new ActionFailure(409, '该评论没有待处理的删除申请。')
    }

    const cleared = await clearDeleteRequest(commentId)
    if (!cleared) {
      throw new ActionFailure(500, '撤回删除申请失败。')
    }

    return { ok: true }
  },
})
