import { z } from 'zod'

import { isCommentOwner } from '@/server/auth/rbac'
import { findCommentWithUserById, requestDeleteComment } from '@/server/db/query/comment'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  commentId: z.string(),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ payload, viewer }) {
    const commentId = BigInt(payload.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(viewer, c)) {
      throw new ActionFailure(404, '资源不存在。')
    }
    if (c.deleteRequestedAt !== null) {
      return { success: true }
    }
    await requestDeleteComment(commentId, BigInt(viewer.userId))
    return { success: true }
  },
})
