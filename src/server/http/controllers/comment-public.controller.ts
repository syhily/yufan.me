import { HTTPException } from 'hono/http-exception'

import type { PublicContractImpl } from '@/server/http/ts-rest-adapter'

import { AvatarStatus, cacheAvatar } from '@/server/cache/avatar'
import { updateComment, getCommentById } from '@/server/comments/admin'
import { decreaseLikes, increaseLikes, queryLikes, validateLikeToken } from '@/server/comments/likes'
import { parseComments, loadComments, createComment } from '@/server/comments/loader'
import { appendCommentToken, issueCommentToken, verifyCommentOwnership } from '@/server/comments/token'
import { findCommentWithUserById } from '@/server/db/query/comment'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { findUserIdByEmail } from '@/server/db/query/user'
import { fetchQQAvatarImage, isQQEmail } from '@/server/images/avatar-fetch'
import { tryLikeIncreaseRateLimit, tryCommentPostRateLimit, tryCommentPostRateLimitByEmail } from '@/server/rate-limit'
import { clearCsrfCookie, issueCsrfToken, userSession, validateRequestCsrf } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'
import { commentPublicContract } from '@/shared/contracts/comment-public'
import { encodedEmail } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

function metricTarget(key: string) {
  return async () => {
    const row = await findMetricByPublicId(key)
    if (row === null || row.type === null || row.ownerId === null) {
      throw new HTTPException(404, { message: '评论目标不存在' })
    }
    return { type: row.type as 'post' | 'page', ownerId: row.ownerId }
  }
}

export const commentPublicController: PublicContractImpl<typeof commentPublicContract> = {
  increaseLike: async ({ body }, { clientAddress }) => {
    const limit = await tryLikeIncreaseRateLimit(clientAddress)
    if (limit.exceeded) {
      return { status: 429 as const, body: { error: { message: '点赞过于频繁，请稍后再试。' } } }
    }
    const target = await metricTarget(body.key)()
    return { status: 200 as const, body: { ...(await increaseLikes(target)), key: body.key } }
  },

  decreaseLike: async ({ body }) => {
    const target = await metricTarget(body.key)()
    await decreaseLikes(target, body.token)
    return { status: 200 as const, body: { key: body.key, likes: await queryLikes(target) } }
  },

  validateLikeToken: async ({ body }) => {
    const row = await findMetricByPublicId(body.key)
    if (row === null || row.type === null || row.ownerId === null) {
      return { status: 200 as const, body: { key: body.key, valid: false } }
    }
    const target = { type: row.type as 'post' | 'page', ownerId: row.ownerId }
    return { status: 200 as const, body: { key: body.key, valid: await validateLikeToken(target, body.token) } }
  },

  findAvatar: async ({ body }) => {
    const { email } = body
    const id = await findUserIdByEmail(email)
    const hash = id === null ? await encodedEmail(email) : id

    if (isQQEmail(email)) {
      const canonicalHash = await encodedEmail(email)
      const buffer = await fetchQQAvatarImage(email)
      if (buffer !== null) {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.HAVE_AVATAR, buffer })
      } else {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.NO_AVATAR })
      }
    }

    return {
      status: 200 as const,
      body: {
        avatar: joinUrl(requireBlogSettingsSection('siteIdentity').website, 'images/avatar', `${hash}.png`),
      },
    }
  },

  replyComment: async ({ body }, { request, clientAddress, session }) => {
    const [csrfOk] = await validateRequestCsrf(request, body.csrf)
    if (!csrfOk) {
      return {
        status: 403 as const,
        body: { error: { message: '页面安全令牌已失效，请刷新后重试。' } },
        headers: { 'Set-Cookie': [await clearCsrfCookie()] },
      }
    }

    const isAdmin = userSession(session)?.role === 'admin'

    if (!isAdmin) {
      const byIp = await tryCommentPostRateLimit(clientAddress)
      if (byIp.exceeded) {
        return { status: 429 as const, body: { error: { message: '请求过于频繁，请稍后再试。' } } }
      }
      const byEmail = await tryCommentPostRateLimitByEmail(body.email)
      if (byEmail.exceeded) {
        return { status: 429 as const, body: { error: { message: '请求过于频繁，请稍后再试。' } } }
      }
    }

    const { subtitle: _subtitle, csrf: _csrf, ...commentPayload } = body
    void _subtitle
    void _csrf

    const comment = await createComment(commentPayload as any, request, clientAddress, session)
    const rotated = await issueCsrfToken()

    const setCookies: string[] = [rotated.setCookie]

    if (!isAdmin) {
      const ttl = requireBlogSettingsSection('comments').comments.tokenTtlSeconds
      const token = await issueCommentToken(comment.id, comment.userId, body.page_key, ttl)
      const existing = parseCommentTokensCookie(request.headers.get('Cookie'))
      const next = appendCommentToken(existing, body.page_key, token, ttl)
      setCookies.push(serializeCommentTokensCookie(next))
    }

    return {
      status: 200 as const,
      body: { comment, csrfToken: rotated.token },
      headers: { 'Set-Cookie': setCookies },
    }
  },

  loadComments: async ({ query }, { session }) => {
    const row = await findMetricByPublicId(query.page_key)
    if (row === null || row.type === null || row.ownerId === null) {
      return { status: 404 as const, body: { error: { message: '评论目标不存在' } } }
    }
    const target = { type: row.type as 'post' | 'page', ownerId: row.ownerId }
    const comments = await loadComments(session, target, query.offset)
    if (comments === null) {
      return { status: 500 as const, body: { error: { message: '无法连接到评论服务器' } } }
    }
    const items = await parseComments(comments.comments)
    const next = requireBlogSettingsSection('comments').comments.size + query.offset < comments.roots_count
    return { status: 200 as const, body: { comments: items, next } }
  },

  getRaw: async ({ query }, { request, session }) => {
    const admin = userSession(session)?.role === 'admin'
    const setCookies: string[] = []

    if (!admin) {
      const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
      const { ok, cleaned } = await verifyCommentOwnership(cookie, query.rid)
      if (!ok) {
        return { status: 403 as const, body: { error: { message: '无权查看该评论' } } }
      }
      setCookies.push(serializeCommentTokensCookie(cleaned))
    }

    const comment = await getCommentById(query.rid)
    if (!comment) {
      return { status: 404 as const, body: { error: { message: '评论不存在' } } }
    }

    return {
      status: 200 as const,
      body: { body: comment.body },
      headers: setCookies.length > 0 ? { 'Set-Cookie': setCookies } : undefined,
    }
  },

  edit: async ({ params, body }, { request, session }) => {
    const sessionUser = userSession(session)
    const isAdmin = sessionUser?.role === 'admin'
    const setCookies: string[] = []

    if (!isAdmin) {
      const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
      const { ok: ownerByToken, cleaned } = await verifyCommentOwnership(cookie, params.rid)

      if (ownerByToken) {
        setCookies.push(serializeCommentTokensCookie(cleaned))
      } else {
        const commentId = BigInt(params.rid)
        const row = await findCommentWithUserById(commentId)
        const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id

        if (!ownerBySession) {
          return { status: 403 as const, body: { error: { message: '无权编辑该评论' } } }
        }
      }
    }

    const updated = await updateComment(params.rid, body.body as any)
    if (!updated) {
      return { status: 500 as const, body: { error: { message: '更新评论失败' } } }
    }

    return {
      status: 200 as const,
      body: { comment: updated },
      headers: setCookies.length > 0 ? { 'Set-Cookie': setCookies } : undefined,
    }
  },
}
