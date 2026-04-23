import { joinPaths } from '@astrojs/internal-helpers/path'
import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'

import config from '@/blog.config'
import Comment from '@/components/comment/Comment.astro'
import CommentItem from '@/components/comment/CommentItem.astro'
import { queryUserId } from '@/helpers/auth/user'
import { decreaseLikes, increaseLikes, queryLikes, validateLikeToken } from '@/helpers/comment/likes'
import {
  approveComment,
  createComment,
  deleteComment,
  getCommentAuthors,
  getCommentById,
  getPageOptions,
  loadAllComments,
  loadComments,
  updateComment,
} from '@/helpers/comment/loader'
import { partialRender } from '@/helpers/content/render'
import { getPosts, pages } from '@/helpers/content/schema'
import { ErrorMessages } from '@/helpers/errors'
import { encodedEmail } from '@/helpers/tools'
import {
  commentEditSchema,
  commentReplySchema,
  commentRidSchema,
  loadAllCommentsSchema,
  loadCommentsSchema,
} from '@/schemas/comment'
import { catchDomain, withAdmin, withSession } from '@/web/actions/middleware'

const keys = [
  ...getPosts({ hidden: true, schedule: true }).map((post) => post.permalink),
  ...pages.map((page) => page.permalink),
]

export const comment = {
  increaseLike: defineAction({
    accept: 'json',
    input: z.object({ key: z.enum(keys) }),
    handler: catchDomain(async (input) => increaseLikes(input.key)),
  }),
  decreaseLike: defineAction({
    accept: 'json',
    input: z.object({ key: z.enum(keys), token: z.string().min(1) }),
    handler: catchDomain(async (input) => {
      await decreaseLikes(input.key, input.token)
      return { likes: await queryLikes(input.key) }
    }),
  }),
  validateLikeToken: defineAction({
    accept: 'json',
    input: z.object({ key: z.enum(keys), token: z.string().min(1) }),
    handler: catchDomain(async (input) => ({
      valid: await validateLikeToken(input.key, input.token),
    })),
  }),
  findAvatar: defineAction({
    accept: 'json',
    input: z.object({ email: z.email() }),
    handler: catchDomain(async ({ email }) => {
      const id = await queryUserId(email)
      const hash = id === null ? encodedEmail(email) : `${id}`
      return { avatar: joinPaths(config.website, 'images/avatar', `${hash}.png`) }
    }),
  }),
  replyComment: defineAction({
    accept: 'json',
    input: commentReplySchema,
    handler: catchDomain(
      withSession(async (input, ctx) => {
        const comment = await createComment(input, ctx.request, ctx.clientAddress, ctx.session!)
        const content = await partialRender(CommentItem, {
          props: {
            depth: comment.rid === 0 ? 1 : 2,
            comment,
            pending: comment.isPending,
            session: ctx.session,
          },
          request: ctx.request,
        })
        return { content }
      }),
    ),
  }),
  approve: defineAction({
    accept: 'json',
    input: commentRidSchema,
    handler: catchDomain(
      withAdmin(async ({ rid }) => {
        await approveComment(rid)
      }, ErrorMessages.NOT_ADMIN_SYSTEM),
    ),
  }),
  delete: defineAction({
    accept: 'json',
    input: commentRidSchema,
    handler: catchDomain(
      withAdmin(async ({ rid }) => {
        await deleteComment(rid)
      }, ErrorMessages.NOT_ADMIN_SYSTEM),
    ),
  }),
  loadComments: defineAction({
    accept: 'json',
    input: loadCommentsSchema,
    handler: catchDomain(async ({ page_key, offset }, ctx) => {
      const comments = await loadComments(ctx.session, page_key, null, Number(offset))
      if (comments === null) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.COMMENT_SERVER_ERROR,
        })
      }
      const content = await partialRender(Comment, { props: { comments, session: ctx.session }, request: ctx.request })
      const next = config.settings.comments.size + offset < comments.roots_count
      return { content, next }
    }),
  }),
  // Get raw comment content (for admin editing)
  getRaw: defineAction({
    accept: 'json',
    input: commentRidSchema,
    handler: catchDomain(
      withAdmin(async ({ rid }) => {
        const c = await getCommentById(rid)
        if (!c) {
          throw new ActionError({ code: 'NOT_FOUND', message: ErrorMessages.COMMENT_NOT_FOUND })
        }
        return { content: c.content }
      }),
    ),
  }),
  // Edit an existing comment (admin only)
  edit: defineAction({
    accept: 'json',
    input: commentEditSchema,
    handler: catchDomain(
      withAdmin(async ({ rid, content }, ctx) => {
        const updated = await updateComment(rid, content)
        if (!updated) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: ErrorMessages.COMMENT_UPDATE_FAILED,
          })
        }

        const html = await partialRender(CommentItem, {
          props: {
            depth: updated.rid === 0 ? 1 : 2,
            comment: updated,
            pending: updated.isPending,
            session: ctx.session,
          },
          request: ctx.request,
        })

        return { content: html }
      }),
    ),
  }),
  // Get filter options for admin panel
  getFilterOptions: defineAction({
    accept: 'json',
    input: z.object({}),
    handler: catchDomain(
      withAdmin(async () => ({
        pages: await getPageOptions(),
        authors: await getCommentAuthors(),
      })),
    ),
  }),
  // Load all comments with pagination (admin only)
  loadAll: defineAction({
    accept: 'json',
    input: loadAllCommentsSchema,
    handler: catchDomain(
      withAdmin(async ({ offset, limit, pageKey, userId }) => {
        const userIdBigint = userId ? BigInt(userId) : undefined
        return loadAllComments(offset, limit, pageKey, userIdBigint)
      }),
    ),
  }),
}
