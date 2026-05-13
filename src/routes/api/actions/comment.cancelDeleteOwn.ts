import { z } from 'zod'

import { userSession } from '@/server/auth/primitives'
import { clearDeleteRequest, findCommentWithUserById } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  commentId: z.string(),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const commentId = BigInt(payload.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || c.userId.toString() !== user!.id) {
      throw new ActionFailure(404, '资源不存在。')
    }
    const ok = await clearDeleteRequest(commentId, BigInt(user!.id))
    if (!ok) {
      throw new ActionFailure(409, '无法撤回删除申请。')
    }
    return { success: true }
  },
})
