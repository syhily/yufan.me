import { z } from 'zod'

import { canManageComment } from '@/server/auth/rbac'
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
  async run({ payload, viewer }) {
    const commentId = BigInt(payload.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !canManageComment(viewer, c)) {
      throw new ActionFailure(404, '资源不存在。')
    }
    const ok = await clearDeleteRequest(commentId, BigInt(viewer.userId))
    if (!ok) {
      throw new ActionFailure(409, '无法撤回删除申请。')
    }
    return { success: true }
  },
})
