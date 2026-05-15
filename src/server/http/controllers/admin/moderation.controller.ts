import type { adminModerationContract } from '@/shared/contracts/admin/moderation'

import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { deleteCommentById } from '@/server/db/query/comment'
import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { bulkApproveCommentsForUser, bulkDeleteCommentsForUser } from '@/server/users/service'

export const adminModerationController: ContractImpl<typeof adminModerationContract> = {
  bulkApproveComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const body = args.body as { userId: string }
    const result = await bulkApproveCommentsForUser(BigInt(body.userId))
    return { status: 200, body: result }
  },

  bulkSoftDeleteComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const body = args.body as { userId: string }
    const result = await bulkDeleteCommentsForUser(BigInt(body.userId))
    return { status: 200, body: result }
  },

  approveCommentDeletion: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const body = args.body as { commentId: string }
    // Approving a deletion request means the admin accepts the user's
    // request and actually deletes the comment.
    await deleteCommentById(BigInt(body.commentId))
    return { status: 200, body: { success: true } }
  },

  listPendingDashboard: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      kind?: 'all' | 'approval' | 'deletion'
      offset?: number
      limit?: number
    }
    const result = await loadAdminPendingDashboard(q.kind ?? 'all', q.offset ?? 0, q.limit ?? 20)
    return { status: 200, body: result }
  },
}
