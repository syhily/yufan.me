import { joinPaths } from '@astrojs/internal-helpers/path'
import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import config from '@/blog.config'
import Comment from '@/components/comment/Comment.astro'
import CommentItem from '@/components/comment/CommentItem.astro'
import { requireAdmin } from '@/helpers/auth/session'
import { queryUserId } from '@/helpers/auth/user'
import { decreaseLikes, increaseLikes, queryLikes, validateLikeToken } from '@/helpers/comment/likes'
import { approveComment, createComment, deleteComment, getCommentById, loadComments, updateComment } from '@/helpers/comment/loader'
import { partialRender } from '@/helpers/content/render'
import { getPosts, pages } from '@/helpers/content/schema'
import { ErrorMessages } from '@/helpers/errors'
import { encodedEmail } from '@/helpers/tools'

const keys = [...getPosts({ hidden: true, schedule: true }).map(post => post.permalink), ...pages.map(page => page.permalink)]

export const comment = {
  increaseLike: defineAction({
    accept: 'json',
    input: z
      .object({
        key: z.custom<string>(val => keys.includes(val)),
      }),
    handler: async (input) => {
      return await increaseLikes(input.key)
    },
  }),
  decreaseLike: defineAction({
    accept: 'json',
    input: z
      .object({
        key: z.custom<string>(val => keys.includes(val)),
        token: z.string().min(1),
      }),
    handler: async (input) => {
      await decreaseLikes(input.key, input.token)
      return { likes: await queryLikes(input.key) }
    },
  }),
  validateLikeToken: defineAction({
    accept: 'json',
    input: z
      .object({
        key: z.custom<string>(val => keys.includes(val)),
        token: z.string().min(1),
      }),
    handler: async (input) => {
      const isValid = await validateLikeToken(input.key, input.token)
      return { valid: isValid }
    },
  }),
  findAvatar: defineAction({
    accept: 'json',
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }) => {
      const id = await queryUserId(email)
      const hash = id === null ? encodedEmail(email) : `${id}`
      return { avatar: joinPaths(config.website, 'images/avatar', `${hash}.png`) }
    },
  }),
  replyComment: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      name: z.string(),
      email: z.string().email(),
      link: z.string().optional(),
      content: z.string().min(1),
      rid: z.number().optional(),
    }),
    handler: async (input, { request, clientAddress, session }) => {
      if (session === undefined) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: ErrorMessages.SESSION_NOT_CONFIGURED })
      }
      const resp = await createComment(input, request, clientAddress, session)
      if ('msg' in resp) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: resp.msg,
        })
      }

      const content = await partialRender(CommentItem, {
        props: {
          depth: resp.rid === 0 ? 1 : 2,
          comment: resp,
          pending: resp.isPending,
          session,
        },
        request,
      })

      return { content }
    },
  }),
  approve: defineAction({
    accept: 'json',
    input: z.object({ rid: z.string() }),
    handler: async ({ rid }, { session }) => {
      await requireAdmin(session, ErrorMessages.NOT_ADMIN_SYSTEM)
      await approveComment(rid)
    },
  }),
  delete: defineAction({
    accept: 'json',
    input: z.object({ rid: z.string() }),
    handler: async ({ rid }, { session }) => {
      await requireAdmin(session, ErrorMessages.NOT_ADMIN_SYSTEM)
      await deleteComment(rid)
    },
  }),
  loadComments: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      offset: z.number(),
    }),
    handler: async ({ page_key, offset }, { session, request }) => {
      const comments = await loadComments(session, page_key, null, Number(offset))
      if (comments === null) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.COMMENT_SERVER_ERROR,
        })
      }

      const content = await partialRender(Comment, { props: { comments, session }, request })
      const next
        = config.settings.comments.size + offset < comments.roots_count

      return { content, next }
    },
  }),
  // Get raw comment content (for admin editing)
  getRaw: defineAction({
    accept: 'json',
    input: z.object({ rid: z.string() }),
    handler: async ({ rid }, { session }) => {
      await requireAdmin(session)
      const c = await getCommentById(rid)
      if (!c) {
        throw new ActionError({ code: 'NOT_FOUND', message: ErrorMessages.COMMENT_NOT_FOUND })
      }
      return { content: c.content }
    },
  }),
  // Edit an existing comment (admin only)
  edit: defineAction({
    accept: 'json',
    input: z.object({ rid: z.string(), content: z.string().min(1) }),
    handler: async ({ rid, content }, { session, request }) => {
      await requireAdmin(session)
      const updated = await updateComment(rid, content)
      if (!updated) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: ErrorMessages.COMMENT_UPDATE_FAILED })
      }

      const html = await partialRender(CommentItem, {
        props: {
          depth: updated.rid === 0 ? 1 : 2,
          comment: updated,
          pending: updated.isPending,
          session,
        },
        request,
      })

      return { content: html }
    },
  }),
}
