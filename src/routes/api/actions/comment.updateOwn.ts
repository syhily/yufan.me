import { isCommentOwner } from '@/server/auth/rbac'
import { updateOwnComment } from '@/server/comments/admin'
import { countApprovedRepliesOfComment, findCommentWithUserById } from '@/server/db/query/comment'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { commentBodySchema } from '@/shared/pt/comment-schema'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: commentBodySchema,
  requireRole: 'visitor',
  async run({ ctx, payload, viewer }) {
    // commentId is passed as a query param since POST body is the PT body
    const commentId = BigInt(ctx.url.searchParams.get('commentId') ?? '0')
    if (commentId === 0n) {
      throw new ActionFailure(400, '缺少 commentId')
    }
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(viewer, c)) {
      throw new ActionFailure(404, '资源不存在。')
    }
    if (c.deleteRequestedAt !== null) {
      throw new ActionFailure(409, '已申请删除，无法编辑。')
    }
    const replyCount = await countApprovedRepliesOfComment(commentId)
    if (replyCount > 0) {
      throw new ActionFailure(409, '已有回复，无法再编辑。')
    }
    await updateOwnComment(String(commentId), payload)
    return { success: true }
  },
})
