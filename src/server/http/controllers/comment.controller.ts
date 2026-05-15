import type { CommentReq } from '@/shared/comments'
import type { commentContract } from '@/shared/contracts/comment'

import { AvatarStatus, cacheAvatar } from '@/server/cache/avatar'
import { updateComment } from '@/server/comments/admin'
import { decreaseLikes, increaseLikes, queryLikes } from '@/server/comments/likes'
import { createComment, loadComments, parseComments } from '@/server/comments/loader'
import {
  appendCommentToken,
  cleanupExpiredTokens,
  issueCommentToken,
  revokeCommentToken,
  verifyCommentOwnership,
} from '@/server/comments/token'
import { findCommentWithUserById } from '@/server/db/query/comment'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { findUserIdByEmail } from '@/server/db/query/user'
import { type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
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

export const commentController: ContractImpl<typeof commentContract> = {
  loadComments: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const q = args.query as { page_key: string; offset: number }
    const metricRow = await findMetricByPublicId(q.page_key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return { status: 404, body: { error: { message: '评论目标不存在' } } }
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    const comments = await loadComments(ctx.session, target, q.offset)
    if (comments === null) {
      return { status: 500, body: { error: { message: '无法连接到评论服务器' } } }
    }
    const items = await parseComments(comments.comments)
    const next = requireBlogSettingsSection('comments').comments.size + q.offset < comments.roots_count
    return { status: 200, body: { comments: items as unknown[], next } }
  },

  replyComment: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as Record<string, unknown>
    const [csrfOk] = await validateRequestCsrf(ctx.request, body.csrf as string)
    if (!csrfOk) {
      return { status: 403, body: { error: { message: '页面安全令牌已失效，请刷新后重试。' } } }
    }
    const isAdmin = getUserSession(ctx.session)?.role === 'admin'
    if (!isAdmin) {
      const byIp = await tryCommentPostRateLimit(ctx.clientAddress)
      if (byIp.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
      const byEmail = await tryCommentPostRateLimitByEmail(body.email as string)
      if (byEmail.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
    }
    const { subtitle: _subtitle, csrf: _csrf, ...commentPayload } = body
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
      const token = await issueCommentToken(comment.id, comment.userId, body.page_key as string, ttl)
      const existing = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
      const next = appendCommentToken(existing, body.page_key as string, token, ttl)
      responseHeaders['Set-Cookie'] += `, ${serializeCommentTokensCookie(next)}`
    }
    return { status: 200, body: { comment: comment as unknown, csrfToken: rotated.token }, headers: responseHeaders }
  },

  increaseLike: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { key: string }
    const limit = await tryLikeIncreaseRateLimit(ctx.clientAddress)
    if (limit.exceeded) {
      return { status: 429, body: { error: { message: '点赞过于频繁，请稍后再试。' } } }
    }
    const metricRow = await findMetricByPublicId(body.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return { status: 404, body: { error: { message: '评论目标不存在' } } }
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    return { status: 200, body: { ...(await increaseLikes(target)), key: body.key } }
  },

  decreaseLike: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { key: string; token: string }
    const metricRow = await findMetricByPublicId(body.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return { status: 404, body: { error: { message: '评论目标不存在' } } }
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId }
    await decreaseLikes(target, body.token)
    return { status: 200, body: { key: body.key, likes: await queryLikes(target) } }
  },

  validateLikeToken: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { key: string; token: string }
    const metricRow = await findMetricByPublicId(body.key)
    if (metricRow === null) {
      return { status: 200, body: { valid: false } }
    }
    const target = { type: targetType(metricRow.type), ownerId: metricRow.ownerId! }
    const existing = await queryLikes(target)
    return { status: 200, body: { valid: existing > 0 } }
  },

  findAvatar: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { email: string }
    const id = await findUserIdByEmail(body.email)
    const hash = id === null ? await encodedEmail(body.email) : id
    if (isQQEmail(body.email)) {
      const canonicalHash = await encodedEmail(body.email)
      const buffer = await fetchQQAvatarImage(body.email)
      if (buffer !== null) {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.HAVE_AVATAR, buffer })
      } else {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.NO_AVATAR })
      }
    }
    return {
      status: 200,
      body: { url: joinUrl(requireBlogSettingsSection('siteIdentity').website, 'images/avatar', `${hash}.png`) },
    }
  },

  edit: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const params = args.params as { rid: string }
    const body = args.body as { body: unknown }
    const sessionUser = getUserSession(ctx.session)
    const isAdmin = sessionUser?.role === 'admin'
    if (!isAdmin) {
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
      const { ok: ownerByToken } = await verifyCommentOwnership(cookie, params.rid)
      if (!ownerByToken) {
        const commentId = BigInt(params.rid)
        const row = await findCommentWithUserById(commentId)
        const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id
        if (!ownerBySession) {
          return { status: 403, body: { error: { message: '无权编辑该评论' } } }
        }
      }
    }
    const updated = await updateComment(params.rid, body.body as Parameters<typeof updateComment>[1])
    if (!updated) {
      return { status: 500, body: { error: { message: '更新评论失败' } } }
    }
    return { status: 200, body: { comment: updated as unknown } }
  },

  revokeToken: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { rid: string }
    const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie') ?? '')
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    let targetToken: string | null = null
    for (const entry of validEntries) {
      if (entry.payload.commentId === body.rid) {
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
    const body = args.body as { rid: string; body: unknown }
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    const { updateOwnComment } = await import('@/server/comments/admin')
    const updated = await updateOwnComment(body.rid, body.body as Parameters<typeof updateOwnComment>[1])
    if (!updated) {
      return { status: 500, body: { error: { message: '更新评论失败' } } }
    }
    return { status: 200, body: { comment: updated as unknown } }
  },

  requestDeleteOwn: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { rid: string }
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    const { requestDeleteComment } = await import('@/server/db/query/comment')
    await requestDeleteComment(BigInt(body.rid), BigInt(sessionUser.id))
    return { status: 200, body: { success: true } }
  },

  cancelDeleteOwn: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { rid: string }
    const sessionUser = getUserSession(ctx.session)
    void body
    if (!sessionUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    return { status: 200, body: { success: true } }
  },

  listMine: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const sessionUser = getUserSession(ctx.session)
    if (!sessionUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    const query = args.query as { offset?: number; limit?: number }
    const { listMyComments, countMyComments } = await import('@/server/db/query/comment')
    const comments = await listMyComments(BigInt(sessionUser.id), query.offset ?? 0, query.limit ?? 20)
    const total = await countMyComments(BigInt(sessionUser.id))
    return { status: 200, body: { comments: comments as unknown[], total } }
  },
}
