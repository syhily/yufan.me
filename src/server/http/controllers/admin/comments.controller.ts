import type { adminCommentsContract } from '@/shared/contracts/admin/comments'

import {
  approveComment,
  deleteComment,
  getCommentById,
  loadAllComments,
  searchAuthorOptions,
  searchPageOptions,
} from '@/server/comments/admin'
import { verifyCommentOwnership } from '@/server/comments/token'
import { findCommentWithUserAndTarget } from '@/server/db/query/comment'
import { forbidden, ok, notFound } from '@/server/http/response'
import {
  body,
  query,
  asId,
  requireViewer,
  resolveId,
  type ContractImpl,
  type HandlerContext,
} from '@/server/http/ts-rest-adapter'
import { parseCommentTokensCookie } from '@/shared/comment-token'

interface LoadAllCommentsBody {
  offset: number
  limit: number
  pageKey?: string
  userId?: string
  status?: 'all' | 'pending' | 'approved'
}

interface AdminCommentsSearchQuery {
  q?: string
  limit?: number
  ids?: string[]
  key?: string
}

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
    const id = resolveId(args)
    const isAdmin = ctx.viewer?.role === 'admin'
    if (!isAdmin) {
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
      const { ok: ownerByToken } = await verifyCommentOwnership(cookie, id)
      if (!ownerByToken) {
        return forbidden('无权查看该评论')
      }
    }
    const comment = await getCommentById(id)
    if (!comment) {
      return notFound('评论不存在')
    }
    const target = comment.type && comment.ownerId ? await findCommentWithUserAndTarget(asId(id)) : null
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
    const b = body<LoadAllCommentsBody>(args)
    const userId = b.userId ? asId(b.userId) : undefined
    const result = await loadAllComments(b.offset, b.limit, b.pageKey, userId, b.status)
    return ok(result)
  },

  searchPages: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<AdminCommentsSearchQuery>(args)
    const publicIds = q.key ? [q.key] : q.ids
    const options = await searchPageOptions(q.q, q.limit ?? 20, publicIds)
    return ok({ options })
  },

  searchAuthors: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<AdminCommentsSearchQuery>(args)
    const authorIds = q.ids?.length ? q.ids.map((s) => asId(s)) : undefined
    const options = await searchAuthorOptions(q.q, q.limit ?? 20, authorIds)
    return ok({ options: options.map((o) => ({ id: String(o.id), name: o.name })) })
  },
}
