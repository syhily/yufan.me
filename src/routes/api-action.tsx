import type { ZodError, ZodType } from 'zod'

import { renderToString } from 'react-dom/server'
import { z } from 'zod'

import config from '@/blog.config'
import { AdminCommentList } from '@/components/admin/AdminCommentList'
import { Comment } from '@/components/comment/Comment'
import { CommentItem } from '@/components/comment/CommentItem'
import { updateUserSchema, signUpAdminSchema, signInSchema } from '@/schemas/auth'
import {
  commentEditSchema,
  commentReplySchema,
  commentRidSchema,
  loadAllCommentsSchema,
  loadCommentsSchema,
} from '@/schemas/comment'
import { DomainError } from '@/schemas/errors'
import { ErrorMessages } from '@/shared/messages'
import { getClientAddress } from '@/shared/request'
import { encodedEmail } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

type ActionData = Record<string, unknown> | string | number | boolean | null | undefined

class ActionFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { message: string; path?: string[] }[],
  ) {
    super(message)
    this.name = 'ActionFailure'
  }
}

let permalinkSetPromise: Promise<Set<string>> | null = null

async function validPermalinks(): Promise<Set<string>> {
  if (permalinkSetPromise === null) {
    permalinkSetPromise = (async () => {
      const { getPages, getPosts } = await import('@/services/catalog/schema')
      const [posts, pages] = await Promise.all([getPosts({ hidden: true, schedule: true }), getPages()])
      return new Set<string>([...posts.map((p) => p.permalink), ...pages.map((p) => p.permalink)])
    })()
  }
  return permalinkSetPromise
}

const keySchema = z.string().refine(async (value) => (await validPermalinks()).has(value), {
  message: 'Unknown comment key',
})

function ok(data?: ActionData, headers?: HeadersInit): Response {
  return Response.json({ data }, { headers })
}

function fail(status: number, message: string, issues?: { message: string; path?: string[] }[]): Response {
  return Response.json({ error: { message, issues } }, { status })
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ActionFailure(400, 'Invalid JSON request body')
  }
}

async function parseInput<T>(schema: ZodType<T>, input: unknown): Promise<T> {
  const result = await schema.safeParseAsync(input)
  if (result.success) return result.data
  throw zodFailure(result.error)
}

function zodFailure(error: ZodError): ActionFailure {
  return new ActionFailure(
    400,
    '输入数据无效',
    error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.map(String),
    })),
  )
}

function domainStatus(error: DomainError): number {
  switch (error.code) {
    case 'BAD_REQUEST':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'CONFLICT':
      return 409
    case 'RATE_LIMITED':
      return 429
    case 'INTERNAL':
      return 500
  }
}

async function requireAdminSession(request: Request) {
  const { getRequestSession, isAdmin } = await import('@/services/auth/session.server')
  const session = await getRequestSession(request)
  if (!isAdmin(session)) {
    throw new ActionFailure(401, ErrorMessages.NOT_ADMIN)
  }
  return session
}

async function handleAuth(name: string, input: unknown, request: Request): Promise<Response> {
  switch (name) {
    case 'signIn': {
      const [{ commitSession, getRequestSession, login }, { exceedLimit, incrLimit }] = await Promise.all([
        import('@/services/auth/session.server'),
        import('@/shared/cache.server'),
      ])
      const payload = await parseInput(signInSchema.omit({ token: true }), input)
      const clientAddress = getClientAddress(request)
      if (await exceedLimit(clientAddress)) {
        throw new ActionFailure(429, ErrorMessages.TOO_MANY_LOGIN_ATTEMPTS)
      }

      const session = await getRequestSession(request)
      const authenticated = await login({ ...payload, session, request, clientAddress })
      if (!authenticated) {
        await incrLimit(clientAddress)
        throw new ActionFailure(403, ErrorMessages.INVALID_CREDENTIALS)
      }

      const redirectTo = new URL(request.url).searchParams.get('redirect_to') || '/wp-admin'
      return ok({ redirectTo }, { 'Set-Cookie': await commitSession(session) })
    }

    case 'signUpAdmin': {
      const [{ hasAdmin, insertAdmin }, { commitSession, getRequestSession }] = await Promise.all([
        import('@/db/query/user.server'),
        import('@/services/auth/session.server'),
      ])
      const payload = await parseInput(signUpAdminSchema, input)
      if (await hasAdmin()) {
        throw new ActionFailure(409, ErrorMessages.INSTALLATION_DONE)
      }

      const users = await insertAdmin(payload.name, payload.email, payload.password)
      const admin = users[0]
      if (!admin) {
        throw new ActionFailure(500, ErrorMessages.ADMIN_CREATE_FAILED)
      }

      const session = await getRequestSession(request)
      session.set('user', {
        id: `${admin.id}`,
        name: admin.name,
        email: admin.email,
        website: admin.link,
        admin: true,
      })
      return ok({ redirectTo: '/wp-admin' }, { 'Set-Cookie': await commitSession(session) })
    }

    case 'updateUser': {
      await requireAdminSession(request)
      const { updateUserById } = await import('@/db/query/user.server')
      const { userId, name: userName, email, link, badgeName, badgeColor } = await parseInput(updateUserSchema, input)
      const patch = { name: userName, email, link, badgeName, badgeColor }
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
      if (Object.keys(filtered).length === 0) {
        throw new ActionFailure(400, '至少需要提供一个更新字段')
      }

      const updated = await updateUserById(BigInt(userId), filtered)
      if (updated === null) {
        throw new ActionFailure(404, '用户不存在')
      }
      return ok({ success: true })
    }

    default:
      throw new ActionFailure(404, 'Unknown auth action')
  }
}

async function handleComment(name: string, input: unknown, request: Request): Promise<Response> {
  switch (name) {
    case 'increaseLike': {
      const { increaseLikes } = await import('@/services/comments/likes.server')
      const payload = await parseInput(z.object({ key: keySchema }), input)
      return ok(await increaseLikes(payload.key))
    }

    case 'decreaseLike': {
      const { decreaseLikes, queryLikes } = await import('@/services/comments/likes.server')
      const payload = await parseInput(z.object({ key: keySchema, token: z.string().min(1) }), input)
      await decreaseLikes(payload.key, payload.token)
      return ok({ likes: await queryLikes(payload.key) })
    }

    case 'validateLikeToken': {
      const { validateLikeToken } = await import('@/services/comments/likes.server')
      const payload = await parseInput(z.object({ key: keySchema, token: z.string().min(1) }), input)
      return ok({ valid: await validateLikeToken(payload.key, payload.token) })
    }

    case 'findAvatar': {
      const { findUserIdByEmail } = await import('@/db/query/user.server')
      const { email } = await parseInput(z.object({ email: z.email() }), input)
      const id = await findUserIdByEmail(email)
      const hash = id === null ? await encodedEmail(email) : id
      return ok({ avatar: joinUrl(config.website, 'images/avatar', `${hash}.png`) })
    }

    case 'replyComment': {
      const [{ getRequestSession, isAdmin }, { createComment }] = await Promise.all([
        import('@/services/auth/session.server'),
        import('@/services/comments/loader.server'),
      ])
      const payload = await parseInput(commentReplySchema, input)
      const session = await getRequestSession(request)
      const comment = await createComment(payload, request, getClientAddress(request), session)
      return ok({
        content: renderToString(
          <CommentItem
            comment={comment}
            depth={comment.rid === 0 ? 1 : 2}
            pending={comment.isPending === true}
            admin={isAdmin(session)}
          />,
        ),
      })
    }

    case 'approve': {
      await requireAdminSession(request)
      const { approveComment } = await import('@/services/comments/loader.server')
      const { rid } = await parseInput(commentRidSchema, input)
      await approveComment(rid)
      return ok()
    }

    case 'delete': {
      await requireAdminSession(request)
      const { deleteComment } = await import('@/services/comments/loader.server')
      const { rid } = await parseInput(commentRidSchema, input)
      await deleteComment(rid)
      return ok()
    }

    case 'loadComments': {
      const [{ getRequestSession, isAdmin }, { loadComments, parseComments }] = await Promise.all([
        import('@/services/auth/session.server'),
        import('@/services/comments/loader.server'),
      ])
      const { page_key, offset } = await parseInput(loadCommentsSchema, input)
      const session = await getRequestSession(request)
      const comments = await loadComments(session, page_key, null, Number(offset))
      if (comments === null) {
        throw new ActionFailure(500, ErrorMessages.COMMENT_SERVER_ERROR)
      }
      const items = await parseComments(comments.comments)
      const content = renderToString(<Comment comments={items} admin={isAdmin(session)} />)
      const next = config.settings.comments.size + offset < comments.roots_count
      return ok({ content, next })
    }

    case 'getRaw': {
      await requireAdminSession(request)
      const { getCommentById } = await import('@/services/comments/loader.server')
      const { rid } = await parseInput(commentRidSchema, input)
      const comment = await getCommentById(rid)
      if (!comment) {
        throw new ActionFailure(404, ErrorMessages.COMMENT_NOT_FOUND)
      }
      return ok({ content: comment.content })
    }

    case 'edit': {
      const session = await requireAdminSession(request)
      const [{ isAdmin }, { updateComment }] = await Promise.all([
        import('@/services/auth/session.server'),
        import('@/services/comments/loader.server'),
      ])
      const { rid, content } = await parseInput(commentEditSchema, input)
      const updated = await updateComment(rid, content)
      if (!updated) {
        throw new ActionFailure(500, ErrorMessages.COMMENT_UPDATE_FAILED)
      }
      return ok({
        content: renderToString(
          <CommentItem
            comment={updated}
            depth={updated.rid === 0 ? 1 : 2}
            pending={updated.isPending === true}
            admin={isAdmin(session)}
          />,
        ),
      })
    }

    case 'getFilterOptions': {
      await requireAdminSession(request)
      const { getCommentAuthors, getPageOptions } = await import('@/services/comments/loader.server')
      const [pages, authors] = await Promise.all([getPageOptions(), getCommentAuthors()])
      return ok({
        pages,
        authors: authors.map((author) => ({ id: `${author.id}`, name: author.name })),
      })
    }

    case 'loadAll': {
      await requireAdminSession(request)
      const { loadAllComments } = await import('@/services/comments/loader.server')
      const { offset, limit, pageKey, userId, status } = await parseInput(loadAllCommentsSchema, input)
      const result = await loadAllComments(offset, limit, pageKey, userId ? BigInt(userId) : undefined, status)
      return ok({
        html: renderToString(<AdminCommentList comments={result.comments} />),
        total: result.total,
        hasMore: result.hasMore,
      })
    }

    default:
      throw new ActionFailure(404, 'Unknown comment action')
  }
}

export async function action({ request, params }: { request: Request; params: { domain?: string; name?: string } }) {
  try {
    if (request.method !== 'POST') {
      throw new ActionFailure(405, 'Method Not Allowed')
    }

    const input = await parseJson(request)
    if (params.domain === 'auth' && params.name) {
      return await handleAuth(params.name, input, request)
    }
    if (params.domain === 'comment' && params.name) {
      return await handleComment(params.name, input, request)
    }
    throw new ActionFailure(404, 'Unknown action domain')
  } catch (error) {
    if (error instanceof ActionFailure) {
      return fail(error.status, error.message, error.issues)
    }
    if (error instanceof DomainError) {
      return fail(domainStatus(error), error.message)
    }
    console.error('[api-action] unexpected error', error)
    return fail(500, error instanceof Error ? error.message : '服务器内部错误')
  }
}
