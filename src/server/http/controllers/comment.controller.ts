import type { CommentReq } from '@/shared/comments'
import type { commentContract } from '@/shared/contracts/comment'

import { AvatarStatus, cacheAvatar } from '@/server/cache/avatar'
import { updateComment, updateOwnComment } from '@/server/comments/admin'
import { decreaseLikes, increaseLikes, queryLikes } from '@/server/comments/likes'
import { createComment, loadComments, parseComments } from '@/server/comments/loader'
import {
  appendCommentToken,
  cleanupExpiredTokens,
  issueCommentToken,
  revokeCommentToken,
  verifyCommentOwnership,
} from '@/server/comments/token'
import {
  clearDeleteRequest,
  findCommentWithUserById,
  requestDeleteComment,
  listMyComments,
  countMyComments,
} from '@/server/db/query/comment'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { findUserIdByEmail } from '@/server/db/query/user'
import { conflict, forbidden, internalError, notFound, ok, rateLimited, unauthorized } from '@/server/http/response'
import { body, query, params, asId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { fetchQQAvatarImage, isQQEmail } from '@/server/images/avatar-fetch'
import { tryCommentPostRateLimit, tryCommentPostRateLimitByEmail, tryLikeIncreaseRateLimit } from '@/server/rate-limit'
import { DomainError } from '@/server/route-helpers/errors'
import { issueCsrfToken, userSession as getUserSession, validateRequestCsrf } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'
import { encodedEmail } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

// Cast helper — the metric table's `type` column is constrained to 'post' | 'page'.
function targetType(type: string | null): 'post' | 'page' {
  if (type !== 'post' && type !== 'page') {
    throw new Error(`unexpected metric type: ${type}`)
  }
  return type
}

interface LoadCommentsQuery {
  page_key: string
  offset: number
}

interface ReplyCommentBody {
  csrf: string
  email: string
  page_key: string
  subtitle: string
  [key: string]: unknown
}

interface LikeKeyBody {
  key: string
}

interface LikeKeyTokenBody {
  key: string
  token: string
}

interface FindAvatarBody {
  email: string
}

interface EditCommentParams {
  rid: string
}

interface EditCommentBody {
  body: unknown
}

interface RevokeTokenBody {
  rid: string
}

interface UpdateOwnCommentBody {
  rid: string
  body: unknown
}

interface DeleteOwnCommentBody {
  rid: string
}

interface ListMineQuery {
  offset?: number
  limit?: number
}

export const commentController: ContractImpl<typeof commentContract> = {
  loadComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const q = query<LoadCommentsQuery>(args)
    const metricRow = await findMetricByPublicId(q.page_key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return notFound('评论目标不存在')
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    const comments = await loadComments(ctx.session, target, q.offset)
    if (comments === null) {
      return internalError('无法连接到评论服务器')
    }
    const items = await parseComments(comments.comments)
    const next = requireBlogSettingsSection('comments').comments.size + q.offset < comments.roots_count
    return ok({ comments: items as unknown[], next })
  },

  replyComment: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<ReplyCommentBody>(args)
    const [csrfOk] = await validateRequestCsrf(ctx.request, b.csrf)
    if (!csrfOk) {
      return forbidden('页面安全令牌已失效，请刷新后重试。')
    }
    const isAdmin = getUserSession(ctx.session)?.role === 'admin'
    if (!isAdmin) {
      const byIp = await tryCommentPostRateLimit(ctx.clientAddress)
      if (byIp.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
      const byEmail = await tryCommentPostRateLimitByEmail(b.email)
      if (byEmail.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
    }
    const { subtitle: _subtitle, csrf: _csrf, ...commentPayload } = b
    const comment = await createComment(
      commentPayload as unknown as CommentReq,
      ctx.request,
      ctx.clientAddress,
      ctx.session,
    )
    const rotated = await issueCsrfToken()
    const responseHeaders: Record<string, string> = {}
    responseHeaders['Set-Cookie'] = rotated.setCookie

    if (!isAdmin) {
      const ttl = requireBlogSettingsSection('comments').comments.tokenTtlSeconds
      const token = await issueCommentToken(comment.id, comment.userId, b.page_key, ttl)
      const existing = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
      const next = appendCommentToken(existing, b.page_key, token, ttl)
      responseHeaders['Set-Cookie'] += `, ${serializeCommentTokensCookie(next)}`
    }
    return { status: 200, body: { comment: comment as unknown, csrfToken: rotated.token }, headers: responseHeaders }
  },

  increaseLike: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<LikeKeyBody>(args)
    const limit = await tryLikeIncreaseRateLimit(ctx.clientAddress)
    if (limit.exceeded) {
      return rateLimited('点赞过于频繁，请稍后再试。')
    }
    const metricRow = await findMetricByPublicId(b.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return notFound('评论目标不存在')
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    return ok({ ...(await increaseLikes(target)), key: b.key })
  },

  decreaseLike: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<LikeKeyTokenBody>(args)
    const metricRow = await findMetricByPublicId(b.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return notFound('评论目标不存在')
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    await decreaseLikes(target, b.token)
    return ok({ key: b.key, likes: await queryLikes(target) })
  },

  validateLikeToken: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<LikeKeyTokenBody>(args)
    const metricRow = await findMetricByPublicId(b.key)
    if (metricRow === null) {
      return ok({ key: b.key, valid: false })
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId! }
    const existing = await queryLikes(target)
    return ok({ key: b.key, valid: existing > 0 })
  },

  findAvatar: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<FindAvatarBody>(args)
    const id = await findUserIdByEmail(b.email)
    const hash = id === null ? await encodedEmail(b.email) : id
    if (isQQEmail(b.email)) {
      const canonicalHash = await encodedEmail(b.email)
      const buffer = await fetchQQAvatarImage(b.email)
      if (buffer !== null) {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.HAVE_AVATAR, buffer })
      } else {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.NO_AVATAR })
      }
    }
    return ok({
      url: joinUrl(requireBlogSettingsSection('siteIdentity').website, 'images/avatar', `${hash}.png`),
    })
  },

  edit: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const p = params<EditCommentParams>(args)
    const b = body<EditCommentBody>(args)
    const sessionUser = getUserSession(ctx.session)
    const isAdmin = sessionUser?.role === 'admin'
    if (!isAdmin) {
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
      const { ok: ownerByToken } = await verifyCommentOwnership(cookie, p.rid)
      if (!ownerByToken) {
        const commentId = asId(p.rid)
        const row = await findCommentWithUserById(commentId)
        const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id
        if (!ownerBySession) {
          return forbidden('无权编辑该评论')
        }
      }
    }
    const updated = await updateComment(p.rid, b.body as Parameters<typeof updateComment>[1])
    if (!updated) {
      return internalError('更新评论失败')
    }
    return ok({ comment: updated as unknown })
  },

  revokeToken: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<RevokeTokenBody>(args)
    const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    let targetToken: string | null = null
    for (const entry of validEntries) {
      if (entry.payload.commentId === b.rid) {
        targetToken = entry.token
        break
      }
    }
    if (targetToken) {
      await revokeCommentToken(targetToken)
    }

    const next: Record<string, { token: string; expiresAt: number }[]> = {}
    for (const [pageKey, entries] of Object.entries(cleaned)) {
      const filtered = entries.filter((e) => e.token !== targetToken)
      if (filtered.length > 0) {
        next[pageKey] = filtered
      }
    }

    return {
      status: 200,
      body: { success: true },
      headers: { 'Set-Cookie': serializeCommentTokensCookie(next) },
    }
  },

  updateOwn: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<UpdateOwnCommentBody>(args)
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return unauthorized()
    }
    const updated = await updateOwnComment(b.rid, b.body as Parameters<typeof updateOwnComment>[1])
    if (!updated) {
      return internalError('更新评论失败')
    }
    return ok({ comment: updated as unknown })
  },

  requestDeleteOwn: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<DeleteOwnCommentBody>(args)
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return unauthorized()
    }
    await requestDeleteComment(asId(b.rid), asId(sessionUser.id))
    return ok({ success: true })
  },

  cancelDeleteOwn: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<DeleteOwnCommentBody>(args)
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return unauthorized()
    }
    const commentId = asId(b.rid)
    const row = await findCommentWithUserById(commentId)
    if (!row || row.userId.toString() !== sessionUser.id) {
      return notFound('评论不存在')
    }
    const ok_ = await clearDeleteRequest(commentId, asId(sessionUser.id))
    if (!ok_) {
      return conflict('无法撤回删除申请')
    }
    return ok({ success: true })
  },

  listMine: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return unauthorized()
    }
    const q = query<ListMineQuery>(args)
    const comments = await listMyComments(asId(sessionUser.id), q.offset ?? 0, q.limit ?? 20)
    const total = await countMyComments(asId(sessionUser.id))
    return ok({ comments: comments as unknown[], total })
  },
}
