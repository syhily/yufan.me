import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'
import type { AdminPendingKind } from '@/shared/comments'

import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { adminClearDeleteRequest, findCommentWithUserById, softDeleteCommentById } from '@/server/db/query/comment'
import { getLogger } from '@/server/logger'
import { adminCommentsContract } from '@/shared/contracts/admin/comments'

export const adminCommentsController: AuthedContractImpl<typeof adminCommentsContract> = {
  approveCommentDeletion: async (args, ctx) => {
    const payload = args.body
    const id = BigInt(payload.commentId)
    const c = await findCommentWithUserById(id)
    if (!c) {
      return { status: 404 as const, body: { error: { message: '评论不存在。' } } }
    }
    if (c.deleteRequestedAt === null) {
      return { status: 409 as const, body: { error: { message: '该评论没有待处理的删除申请。' } } }
    }
    if (payload.approve) {
      await softDeleteCommentById(id)
      getLogger('audit.comment').info('delete request approved', {
        actor: ctx.viewer!.userId,
        commentId: payload.commentId,
      })
    } else {
      await adminClearDeleteRequest(id)
      getLogger('audit.comment').info('delete request rejected', {
        actor: ctx.viewer!.userId,
        commentId: payload.commentId,
      })
    }
    return { status: 200 as const, body: { success: true } }
  },
  listPendingDashboard: async (args, _ctx) => {
    const payload = args.query
    const result = await loadAdminPendingDashboard(
      payload.kind as AdminPendingKind,
      payload.offset ?? 0,
      payload.limit ?? 20,
    )
    return { status: 200 as const, body: result }
  },
}
