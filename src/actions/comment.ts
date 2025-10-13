import { joinPaths } from '@astrojs/internal-helpers/path'
import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import config from '@/blog.config'
import Comment from '@/components/comment/Comment.astro'
import CommentItem from '@/components/comment/CommentItem.astro'
import { queryUserId } from '@/helpers/auth/user'
import { decreaseLikes, increaseLikes, queryLikes } from '@/helpers/comment/likes'
import { createComment, loadComments } from '@/helpers/comment/loader'
import { partialRender } from '@/helpers/content/render'
import { getPosts, pages } from '@/helpers/content/schema'
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
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'The Astro session is not correctly configured.' })
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
        },
      })

      return { content }
    },
  }),
  loadComments: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      offset: z.number(),
    }),
    handler: async ({ page_key, offset }) => {
      const comments = await loadComments(page_key, null, Number(offset))
      if (comments === null) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'couldn\'t connect to comment server',
        })
      }

      const content = await partialRender(Comment, { props: { comments } })
      const next
        = config.settings.comments.size + offset < comments.roots_count

      return { content, next }
    },
  }),
}
