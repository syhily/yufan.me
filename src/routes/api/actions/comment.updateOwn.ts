import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { canonicalizeCommentBody } from '@/server/comments/canonicalize'
import { db } from '@/server/db/pool'
import {
  countApprovedRepliesOfComment,
  findCommentWithUserById,
  updateCommentBodyAndContent,
} from '@/server/db/query/comment'
import { comment } from '@/server/db/schema'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const updateOwnCommentSchema = z.object({
  commentId: z.string().min(1),
  body: z.unknown(),
})

export const action = defineApiAction({
  method: 'POST',
  input: updateOwnCommentSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const commentId = BigInt(payload.commentId)
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')

    const c = await findCommentWithUserById(commentId)
    if (c === null || (c.userId !== userId && ctx.role !== 'admin')) {
      throw new ActionFailure(404, '评论不存在。')
    }

    if (c.deleteRequestedAt !== null) {
      throw new ActionFailure(409, '已申请删除，无法编辑。')
    }

    const replyCount = await countApprovedRepliesOfComment(commentId)
    if (replyCount > 0) {
      throw new ActionFailure(409, '已有回复，无法再编辑。')
    }

    const { body: canonicalBody, content: markdownSnapshot } = await canonicalizeCommentBody(payload.body)

    await updateCommentBodyAndContent(commentId, canonicalBody, markdownSnapshot)
    await db.update(comment).set({ isPending: true, updatedAt: new Date() }).where(eq(comment.id, commentId))

    return { ok: true }
  },
})
