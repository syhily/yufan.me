import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import { createComment, loadComments } from '@/components/comment/artalk'
import Comment from '@/components/comment/Comment.astro'
import CommentItem from '@/components/comment/CommentItem.astro'
import { partialRender } from '@/helpers/container'
import options from '@/options'

export const commentActions = {
  comment: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      name: z.string(),
      email: z.string().email(),
      link: z.string().optional(),
      content: z.string().min(1),
      rid: z.number().optional(),
    }),
    handler: async (input, { request, clientAddress }) => {
      const resp = await createComment(input, request, clientAddress)
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
          pending: resp.is_pending,
        },
      })

      return { content }
    },
  }),
  comments: defineAction({
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
        = options.settings.comments.size + offset < comments.roots_count

      return { content, next }
    },
  }),
}
