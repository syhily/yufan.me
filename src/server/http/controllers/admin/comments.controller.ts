import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { db } from '@/server/db/pool'
import { adminClearDeleteRequest, findCommentWithUserById, softDeleteCommentById } from '@/server/db/query/comment'
import { getLogger } from '@/server/logger'
import { userSession } from '@/server/session'
import { adminCommentsContract } from '@/shared/contracts/admin/comments'

export const adminCommentsController = {
  approveCommentDeletion: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
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
        actor: ctx.viewer.userId,
        commentId: payload.commentId,
      })
    } else {
      await adminClearDeleteRequest(id)
      getLogger('audit.comment').info('delete request rejected', {
        actor: ctx.viewer.userId,
        commentId: payload.commentId,
      })
    }
    return { status: 200 as const, body: { success: true } }
  },
  listPendingDashboard: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await loadAdminPendingDashboard(payload.kind, payload.offset, payload.limit)
    return { status: 200 as const, body: result }
  },
}
