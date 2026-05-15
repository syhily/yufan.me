import type { adminModerationContract } from '@/shared/contracts/admin/moderation'

import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { deleteCommentById } from '@/server/db/query/comment'
import { ok } from '@/server/http/response'
import { body, query, asId, requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { bulkApproveCommentsForUser, bulkDeleteCommentsForUser } from '@/server/users/service'

interface UserIdBody {
  userId: string
}

interface CommentIdBody {
  commentId: string
}

interface ModerationQuery {
  kind?: 'all' | 'approval' | 'deletion'
  offset?: number
  limit?: number
}

export const adminModerationController: ContractImpl<typeof adminModerationContract> = {
  bulkApproveComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const b = body<UserIdBody>(args)
    const result = await bulkApproveCommentsForUser(asId(b.userId))
    return ok(result)
  },

  bulkSoftDeleteComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const b = body<UserIdBody>(args)
    const result = await bulkDeleteCommentsForUser(asId(b.userId))
    return ok(result)
  },

  approveCommentDeletion: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const b = body<CommentIdBody>(args)
    // Approving a deletion request means the admin accepts the user's
    // request and actually deletes the comment.
    await deleteCommentById(asId(b.commentId))
    return ok({ success: true })
  },

  listPendingDashboard: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<ModerationQuery>(args)
    const result = await loadAdminPendingDashboard(q.kind ?? 'all', q.offset ?? 0, q.limit ?? 20)
    return ok(result)
  },
}
