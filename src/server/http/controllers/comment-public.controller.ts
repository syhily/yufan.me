import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import type { CommentReq } from '@/shared/types/comments'

import { issueCsrfToken } from '@/server/auth/csrf'
import { userSession } from '@/server/auth/primitives'
import { getCommentById, updateComment } from '@/server/comments/admin'
import { decreaseLikes, increaseLikes, queryLikes, validateLikeToken } from '@/server/comments/likes'
import { createComment, loadComments, parseComments } from '@/server/comments/loader'
import { appendCommentToken, issueCommentToken, verifyCommentOwnership } from '@/server/comments/token'
import { asCommentItemWire, asCommentItemsWire } from '@/server/comments/wire'
import { publicProc } from '@/server/http/orpc-base'
import { fetchQQAvatarImage, isQQEmail } from '@/server/images/avatar-fetch'
import { AvatarStatus, cacheAvatar } from '@/server/infra/cache/avatar'
import { findCommentWithUserById } from '@/server/infra/db/query/comment'
import { findMetricByPublicId } from '@/server/infra/db/query/metric'
import { findUserIdByEmail } from '@/server/infra/db/query/user'
import {
  tryCommentPostRateLimit,
  tryCommentPostRateLimitByEmail,
  tryLikeIncreaseRateLimit,
} from '@/server/infra/rate-limit'
import { requireBlogSettingsSection } from '@/shared/config/blog'
import { commentItemDto } from '@/shared/contracts/comments'
import { commentBodySchema } from '@/shared/pt/comment-schema'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/utils/comment-token'
import { httpUrlOrEmptyStringSchema } from '@/shared/utils/safe-url'
import { encodedEmail } from '@/shared/utils/security'
import { joinUrl } from '@/shared/utils/urls'

const COMMENT_HONEYPOT_MAX_LEN = 240

async function resolveMetricTarget(key: string) {
  const row = await findMetricByPublicId(key)
  if (row === null || row.type === null || row.ownerId === null) {
    throw new ORPCError('NOT_FOUND', { message: '评论目标不存在' })
  }
  if (row.type !== 'post' && row.type !== 'page') {
    throw new ORPCError('BAD_REQUEST', { message: '无效的评论目标类型' })
  }
  return { type: row.type, ownerId: row.ownerId }
}

async function safeResolveMetricTarget(key: string) {
  const row = await findMetricByPublicId(key)
  if (row === null || row.type === null || row.ownerId === null) {
    return null
  }
  if (row.type !== 'post' && row.type !== 'page') {
    return null
  }
  return { type: row.type, ownerId: row.ownerId }
}

// ─── Likes ─────────────────────────────────────────────

const increaseLike = publicProc
  .route({ method: 'POST', path: '/comment-public/increase-like' })
  .input(z.object({ key: z.string() }))
  .output(
    z.object({
      key: z.string(),
      likes: z.number().int().nonnegative(),
      token: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = await tryLikeIncreaseRateLimit(context.clientAddress)
    if (limit.exceeded) {
      throw new ORPCError('TOO_MANY_REQUESTS', { message: '点赞过于频繁，请稍后再试。' })
    }
    const target = await resolveMetricTarget(input.key)
    return { ...(await increaseLikes(target)), key: input.key }
  })

const decreaseLike = publicProc
  .route({ method: 'POST', path: '/comment-public/decrease-like' })
  .input(z.object({ key: z.string(), token: z.string() }))
  .output(z.object({ key: z.string(), likes: z.number().int().nonnegative() }))
  .handler(async ({ input }) => {
    const target = await resolveMetricTarget(input.key)
    await decreaseLikes(target, input.token)
    return { key: input.key, likes: await queryLikes(target) }
  })

const validateLike = publicProc
  .route({ method: 'GET', path: '/comment-public/validate-like' })
  .input(z.object({ key: z.string(), token: z.string() }))
  .output(z.object({ key: z.string(), valid: z.boolean() }))
  .handler(async ({ input }) => {
    const target = await safeResolveMetricTarget(input.key)
    if (target === null) {
      return { key: input.key, valid: false }
    }
    return { key: input.key, valid: await validateLikeToken(target, input.token) }
  })

// ─── Avatar ────────────────────────────────────────────

const findAvatar = publicProc
  .route({ method: 'GET', path: '/comment-public/find-avatar' })
  .input(z.object({ email: z.email() }))
  .output(z.object({ avatar: z.string() }))
  .handler(async ({ input }) => {
    const id = await findUserIdByEmail(input.email)
    const hash = id === null ? await encodedEmail(input.email) : id
    if (isQQEmail(input.email)) {
      const canonicalHash = await encodedEmail(input.email)
      const buffer = await fetchQQAvatarImage(input.email)
      if (buffer !== null) {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.HAVE_AVATAR, buffer })
      } else {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.NO_AVATAR })
      }
    }
    return {
      avatar: joinUrl(requireBlogSettingsSection('siteIdentity').website, 'images/avatar', `${hash}.png`),
    }
  })

// ─── Comments — replyComment / loadComments / getRaw / edit ───

const replyInput = z
  .object({
    page_key: z.string(),
    name: z.string(),
    email: z.email(),
    link: httpUrlOrEmptyStringSchema.optional(),
    body: commentBodySchema,
    // Body-side CSRF still accepted as fallback; primary path is the
    // `X-CSRF-Token` header validated by `csrfGuard` middleware.
    csrf: z.string().min(1).optional(),
    rid: z.number().optional(),
    subtitle: z.string().max(COMMENT_HONEYPOT_MAX_LEN).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.subtitle.trim().length > 0) {
      ctx.addIssue({ code: 'custom', message: '输入数据无效。', path: ['subtitle'] })
    }
  })

const replyComment = publicProc
  .route({ method: 'POST', path: '/comment-public/reply-comment' })
  .input(replyInput)
  .output(z.object({ comment: commentItemDto, csrfToken: z.string() }))
  .handler(async ({ input, context }) => {
    const { request, clientAddress, session, responseHeaders } = context
    const isAdmin = userSession(session)?.role === 'admin'
    if (!isAdmin) {
      const byIp = await tryCommentPostRateLimit(clientAddress)
      if (byIp.exceeded) {
        throw new ORPCError('TOO_MANY_REQUESTS', { message: '请求过于频繁，请稍后再试。' })
      }
      const byEmail = await tryCommentPostRateLimitByEmail(input.email)
      if (byEmail.exceeded) {
        throw new ORPCError('TOO_MANY_REQUESTS', { message: '请求过于频繁，请稍后再试。' })
      }
    }
    const commentPayload: CommentReq = {
      page_key: input.page_key,
      name: input.name,
      email: input.email,
      link: input.link,
      body: input.body,
      rid: input.rid,
    }
    const comment = await createComment(commentPayload, request, clientAddress, session)
    const rotated = await issueCsrfToken()
    responseHeaders.append('Set-Cookie', rotated.setCookie)
    if (!isAdmin) {
      const ttl = requireBlogSettingsSection('comments').comments.tokenTtlSeconds
      const token = await issueCommentToken(comment.id, comment.userId, input.page_key, ttl)
      const existing = parseCommentTokensCookie(request.headers.get('Cookie'))
      const next = appendCommentToken(existing, input.page_key, token, ttl)
      responseHeaders.append('Set-Cookie', serializeCommentTokensCookie(next))
    }
    return { comment: asCommentItemWire(comment), csrfToken: rotated.token }
  })

const list = publicProc
  .route({ method: 'GET', path: '/comment-public/list' })
  .input(z.object({ page_key: z.string(), offset: z.number() }))
  .output(z.object({ comments: z.array(commentItemDto), next: z.boolean() }))
  .handler(async ({ input, context }) => {
    const target = await resolveMetricTarget(input.page_key)
    const comments = await loadComments(context.session, target, input.offset)
    if (comments === null) {
      throw new ORPCError('BAD_GATEWAY', { message: '无法连接到评论服务器' })
    }
    const items = await parseComments(comments.comments)
    const next = requireBlogSettingsSection('comments').comments.size + input.offset < comments.roots_count
    return { comments: asCommentItemsWire(items), next }
  })

const getRaw = publicProc
  .route({ method: 'GET', path: '/comment-public/get-raw' })
  .input(z.object({ rid: z.string() }))
  .output(z.object({ body: commentBodySchema }))
  .handler(async ({ input, context }) => {
    const { request, session, responseHeaders } = context
    const admin = userSession(session)?.role === 'admin'
    if (!admin) {
      const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
      const { ok, cleaned } = await verifyCommentOwnership(cookie, input.rid)
      if (!ok) {
        throw new ORPCError('FORBIDDEN', { message: '无权查看该评论' })
      }
      responseHeaders.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
    }
    const comment = await getCommentById(input.rid)
    if (!comment) {
      throw new ORPCError('NOT_FOUND', { message: '评论不存在' })
    }
    return { body: comment.body }
  })

const edit = publicProc
  .route({ method: 'POST', path: '/comment-public/edit' })
  .input(z.object({ rid: z.string(), body: commentBodySchema }))
  .output(z.object({ comment: commentItemDto }))
  .handler(async ({ input, context }) => {
    const { request, session, responseHeaders } = context
    const sessionUser = userSession(session)
    const isAdmin = sessionUser?.role === 'admin'
    if (!isAdmin) {
      const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
      const { ok: ownerByToken, cleaned } = await verifyCommentOwnership(cookie, input.rid)
      if (ownerByToken) {
        responseHeaders.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
      } else {
        const commentId = BigInt(input.rid)
        const row = await findCommentWithUserById(commentId)
        const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id
        if (!ownerBySession) {
          throw new ORPCError('FORBIDDEN', { message: '无权编辑该评论' })
        }
      }
    }
    const updated = await updateComment(input.rid, input.body)
    if (!updated) {
      throw new ORPCError('NOT_FOUND', { message: '更新评论失败' })
    }
    return { comment: asCommentItemWire(updated) }
  })

export const commentPublicRouter = {
  increaseLike,
  decreaseLike,
  validateLikeToken: validateLike,
  findAvatar,
  replyComment,
  loadComments: list,
  getRaw,
  edit,
}
