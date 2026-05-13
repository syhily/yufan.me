import { z } from 'zod'

import { adminClearDeleteRequest, softDeleteCommentById } from '@/server/db/query/comment'
import { getLogger } from '@/server/logger'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const log = getLogger('audit.comment')

const schema = z.object({
  commentId: z.string(),
  approve: z.boolean(),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    const id = BigInt(payload.commentId)
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
