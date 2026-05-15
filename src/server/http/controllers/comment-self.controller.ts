import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { isCommentOwner } from '@/server/auth/rbac'
import { updateOwnComment } from '@/server/comments/admin'
import { asCommentItemsWire } from '@/server/comments/wire'
import {
  clearDeleteRequest,
  countApprovedRepliesOfComment,
  countMyComments,
  findCommentWithUserById,
  listMyComments,
  requestDeleteComment,
} from '@/server/db/query/comment'
import { authedProc } from '@/server/http/orpc-base'
import { commentItemDto } from '@/shared/contracts/_dtos'
import { commentBodySchema } from '@/shared/pt/comment-schema'

const successOutput = z.object({ success: z.boolean() })

const updateOwn = authedProc
  .input(z.object({ commentId: z.string(), body: commentBodySchema }))
  .output(successOutput)
  .handler(async ({ input, context }) => {
    const commentId = BigInt(input.commentId ?? '0')
    if (commentId === 0n) {
      throw new ORPCError('BAD_REQUEST', { message: '缺少 commentId' })
    }
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(context.viewer, c)) {
      throw new ORPCError('NOT_FOUND', { message: '资源不存在。' })
    }
    if (c.deleteRequestedAt !== null) {
      throw new ORPCError('CONFLICT', { message: '已申请删除，无法编辑。' })
    }
    const replyCount = await countApprovedRepliesOfComment(commentId)
    if (replyCount > 0) {
      throw new ORPCError('CONFLICT', { message: '已有回复，无法再编辑。' })
    }
    await updateOwnComment(String(commentId), input.body as never)
    return { success: true }
  })

const requestDeleteOwn = authedProc
  .input(z.object({ commentId: z.string() }))
  .output(successOutput)
  .handler(async ({ input, context }) => {
    const commentId = BigInt(input.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(context.viewer, c)) {
      throw new ORPCError('NOT_FOUND', { message: '资源不存在。' })
    }
    if (c.deleteRequestedAt !== null) {
      return { success: true }
    }
    await requestDeleteComment(commentId, BigInt(context.viewer.userId))
    return { success: true }
  })

const cancelDeleteOwn = authedProc
  .input(z.object({ commentId: z.string() }))
  .output(successOutput)
  .handler(async ({ input, context }) => {
    const commentId = BigInt(input.commentId)
    const c = await findCommentWithUserById(commentId)
    if (!c || !isCommentOwner(context.viewer, c)) {
      throw new ORPCError('NOT_FOUND', { message: '资源不存在。' })
    }
    const ok = await clearDeleteRequest(commentId, BigInt(context.viewer.userId))
    if (!ok) {
      throw new ORPCError('CONFLICT', { message: '无法撤回删除申请。' })
    }
    return { success: true }
  })

const listMine = authedProc
  .input(
    z.object({ offset: z.coerce.number().min(0).default(0), limit: z.coerce.number().min(1).max(100).default(20) }),
  )
  .output(
    z.object({
      comments: z.array(commentItemDto),
      total: z.number().int(),
      pending: z.number().int(),
      deleteRequested: z.number().int(),
      hasMore: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = BigInt(context.viewer.userId)
    const offset = input.offset
    const limit = Math.min(input.limit, 100)
    const [comments, counts] = await Promise.all([listMyComments(userId, offset, limit), countMyComments(userId)])
    return {
      comments: asCommentItemsWire(comments),
      total: counts.total,
      pending: counts.pending,
      deleteRequested: counts.deleteRequested,
      hasMore: offset + comments.length < counts.total,
    }
  })

export const commentSelfRouter = {
  updateOwn,
  requestDeleteOwn,
  cancelDeleteOwn,
  listMine,
}
