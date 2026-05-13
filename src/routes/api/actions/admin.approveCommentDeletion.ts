import { z } from 'zod'

import { adminClearDeleteRequest, findCommentWithUserById, softDeleteCommentById } from '@/server/db/query/comment'
import { getLogger } from '@/server/logger'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.comment')

const schema = z.object({
  commentId: z.string(),
  approve: z.boolean(),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    const id = BigInt(payload.commentId)
    // Guard the semantics of this endpoint: «approve a pending delete
    // request». Without this check, an admin can use this route as a
    // generic "soft-delete any comment" path — the audit log would lie
    // about user-driven approval, and the boundary between admin's
    // unilateral delete (admin.deleteComment) and this approval-driven
    // delete would dissolve.
    const c = await findCommentWithUserById(id)
    if (!c) {
      throw new ActionFailure(404, '评论不存在。')
    }
    if (c.deleteRequestedAt === null) {
      throw new ActionFailure(409, '该评论没有待处理的删除申请。')
    }
    if (payload.approve) {
      await softDeleteCommentById(id)
      log.info('delete request approved', { actor: viewer.userId, commentId: payload.commentId })
    } else {
      await adminClearDeleteRequest(id)
      log.info('delete request rejected', { actor: viewer.userId, commentId: payload.commentId })
    }
    return { success: true }
  },
})
