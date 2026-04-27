import type { MiddlewareFunction } from 'react-router'

import { getCommentById } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const loader = defineApiAction({
  method: 'GET',
  input: commentRidSchema,
  async run({ payload }) {
    const comment = await getCommentById(payload.rid)
    if (!comment) {
      throw new ActionFailure(404, '评论不存在')
    }
    return { content: comment.content }
  },
})
