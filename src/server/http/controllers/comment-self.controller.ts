import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { isCommentOwner } from '@/server/auth/rbac'
import { updateOwnComment } from '@/server/comments/admin'
import { asCommentItemsWire } from '@/server/comments/wire'
import {
  countApprovedRepliesOfComment,
  clearDeleteRequest,
  findCommentWithUserById,
  listMyComments,
  countMyComments,
  requestDeleteComment,
} from '@/server/db/query/comment'
import { commentSelfContract } from '@/shared/contracts/comment-self'

export const commentSelfController: AuthedContractImpl<typeof commentSelfContract> = {
  updateOwn: async ({ body }, { viewer }) => {
    const commentId = BigInt(body.commentId ?? '0')
    if (commentId === 0n) {
      return { status: 400 as const, body: { error: { message: '缺少 commentId' } } }
    }
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(viewer, c)) {
      return { status: 404 as const, body: { error: { message: '资源不存在。' } } }
    }
    if (c.deleteRequestedAt !== null) {
      return { status: 409 as const, body: { error: { message: '已申请删除，无法编辑。' } } }
    }
    const replyCount = await countApprovedRepliesOfComment(commentId)
    if (replyCount > 0) {
      return { status: 409 as const, body: { error: { message: '已有回复，无法再编辑。' } } }
    }
    await updateOwnComment(String(commentId), body.body as any)
    return { status: 200 as const, body: { success: true } }
  },

  requestDeleteOwn: async ({ body }, { viewer }) => {
    const commentId = BigInt(body.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(viewer, c)) {
      return { status: 404 as const, body: { error: { message: '资源不存在。' } } }
    }
    if (c.deleteRequestedAt !== null) {
      return { status: 200 as const, body: { success: true } }
    }
    await requestDeleteComment(commentId, BigInt(viewer.userId))
    return { status: 200 as const, body: { success: true } }
  },

  cancelDeleteOwn: async ({ body }, { viewer }) => {
    const commentId = BigInt(body.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(viewer, c)) {
      return { status: 404 as const, body: { error: { message: '资源不存在。' } } }
    }
    const ok = await clearDeleteRequest(commentId, BigInt(viewer.userId))
    if (!ok) {
      return { status: 409 as const, body: { error: { message: '无法撤回删除申请。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },

  listMine: async ({ query }, { viewer }) => {
    const userId = BigInt(viewer.userId)
    const offset = query.offset ?? 0
    const limit = Math.min(query.limit ?? 20, 100)
    const [comments, counts] = await Promise.all([listMyComments(userId, offset, limit), countMyComments(userId)])
    return {
      status: 200 as const,
      body: {
        comments: asCommentItemsWire(comments),
        total: counts.total,
        pending: counts.pending,
        deleteRequested: counts.deleteRequested,
        hasMore: offset + comments.length < counts.total,
      },
    }
  },
}
