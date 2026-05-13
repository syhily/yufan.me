import { z } from 'zod'

import { findCommentWithUserById, requestDeleteComment } from '@/server/db/query/comment'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const requestDeleteOwnCommentSchema = z.object({
  commentId: z.string().min(1),
})

export const action = defineApiAction({
  method: 'POST',
  input: requestDeleteOwnCommentSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const commentId = BigInt(payload.commentId)
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')

    const comment = await findCommentWithUserById(commentId)
    if (comment === null || comment.userId !== userId) {
      throw new ActionFailure(404, '评论不存在。')
    }

    // Idempotent: if already requested, just return 200.
    if (comment.deleteRequestedAt !== null) {
      return { ok: true, alreadyRequested: true }
    }

    const done = await requestDeleteComment(commentId, userId)
    if (!done) {
      // Could have been already requested in a race.
      return { ok: true, alreadyRequested: true }
    }

    return { ok: true }
  },
})
