import type { adminCommentsContract } from '@/shared/contracts/admin/comments'

import {
  approveComment,
  deleteComment,
  getCommentById,
  loadAllComments,
  searchAuthorOptions,
  searchPageOptions,
} from '@/server/comments/admin'
import { findCommentWithUserAndTarget } from '@/server/db/query/comment'
import { ok, notFound } from '@/server/http/response'
import { requireViewer, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'

export const adminCommentsController: ContractImpl<typeof adminCommentsContract> = {
  approve: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const id = resolveId(args)
    await approveComment(id)
    return ok({ success: true })
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const id = resolveId(args)
    await deleteComment(id)
    return ok({ success: true })
  },

  getRaw: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const id = resolveId(args)
    const comment = await getCommentById(id)
    if (!comment) {
      return notFound('评论不存在')
    }
    const target = comment.type && comment.ownerId ? await findCommentWithUserAndTarget(BigInt(id)) : null
    return ok({
      id: String(comment.id),
      body: comment.body,
      content: comment.content,
      name: comment.name,
      email: comment.email,
      pageTitle: target ? ((target as any).entityTitle ?? null) : null,
      pagePublicId: target ? ((target as any).metric?.publicId ?? null) : null,
    })
  },

  loadAll: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as {
      offset: number
      limit: number
      pageKey?: string
      userId?: string
      status?: 'all' | 'pending' | 'approved'
    }
    const userId = body.userId ? BigInt(body.userId) : undefined
    const result = await loadAllComments(body.offset, body.limit, body.pageKey, userId, body.status)
    return ok(result)
  },

  searchPages: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      q?: string
      limit?: number
      ids?: string[]
      key?: string
    }
    const publicIds = q.key ? [q.key] : q.ids
    const options = await searchPageOptions(q.q, q.limit ?? 20, publicIds)
    return ok({ options })
  },

  searchAuthors: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      q?: string
      limit?: number
      ids?: string[]
      key?: string
    }
    const authorIds = q.ids?.length ? q.ids.map((s) => BigInt(s)) : undefined
    const options = await searchAuthorOptions(q.q, q.limit ?? 20, authorIds)
    return ok({ options: options.map((o) => ({ id: String(o.id), name: o.name })) })
  },
}
