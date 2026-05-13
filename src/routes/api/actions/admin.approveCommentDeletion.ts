import { z } from 'zod'

import { softDeleteCommentById } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const schema = z.object({
  commentId: z.string(),
  approve: z.boolean(),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireAdmin: true,
  async run({ payload }) {
    const id = BigInt(payload.commentId)
    if (payload.approve) {
      await softDeleteCommentById(id)
    } else {
      // Reject: clear delete request
      const { db } = await import('@/server/db/pool')
      const { comment } = await import('@/server/db/schema')
      const { eq, and, isNotNull } = await import('drizzle-orm')
      await db
        .update(comment)
        .set({ deleteRequestedAt: null, deleteRequestedBy: null })
        .where(and(eq(comment.id, id), isNotNull(comment.deleteRequestedAt)))
    }
    return { success: true }
  },
})
