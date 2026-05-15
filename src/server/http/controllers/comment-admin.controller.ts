import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'
import type { AdminPendingKind } from '@/shared/comments'

import {
  approveComment,
  deleteComment,
  loadAdminPendingDashboard,
  loadAllComments,
  searchAuthorOptions,
  searchPageOptions,
} from '@/server/comments/admin'
import { adminClearDeleteRequest, findCommentWithUserById, softDeleteCommentById } from '@/server/db/query/comment'
import { getLogger } from '@/server/logger'
import { commentAdminContract } from '@/shared/contracts/comment-admin'

export const commentAdminController: AuthedContractImpl<typeof commentAdminContract> = {
  approve: async ({ params }) => {
    await approveComment(params.rid)
    return { status: 204 as const, body: null }
  },

  delete: async ({ params }) => {
    await deleteComment(params.rid)
    return { status: 204 as const, body: null }
  },

  loadAll: async ({ body }) => {
    const result = await loadAllComments(
      body.offset,
      body.limit,
      body.pageKey,
      body.userId ? BigInt(body.userId) : undefined,
      body.status,
    )
    return {
      status: 200 as const,
      body: {
        comments: result.comments,
        total: result.total,
        hasMore: result.hasMore,
        statusCounts: result.statusCounts,
      },
    }
  },

  searchPages: async ({ query }) => {
    const keys = query.key ? [query.key] : undefined
    const pages = await searchPageOptions(query.q, query.limit, keys)
    return { status: 200 as const, body: { pages } }
  },

  searchAuthors: async ({ query }) => {
    function parseBigIntIds(raw: string | undefined): bigint[] | undefined {
      if (!raw || raw.length === 0) {
        return undefined
      }
      const out: bigint[] = []
      for (const value of raw.split(',')) {
        const trimmed = value.trim()
        if (!trimmed) {
          continue
        }
        try {
          out.push(BigInt(trimmed))
        } catch {
          /* drop */
        }
      }
      return out.length > 0 ? out : undefined
    }

    const ids = parseBigIntIds(query.ids)
    const authors = await searchAuthorOptions(query.q, query.limit, ids)
    return {
      status: 200 as const,
      body: {
        authors: authors.map((author) => ({ id: String(author.id), name: author.name })),
      },
    }
  },

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
