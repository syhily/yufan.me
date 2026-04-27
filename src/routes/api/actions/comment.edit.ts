import type { MiddlewareFunction } from 'react-router'

import { updateComment } from '@/server/comments/admin'
import { commentEditSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const action = defineApiAction({
  method: 'PATCH',
  input: commentEditSchema,
  async run({ payload }) {
    const updated = await updateComment(payload.rid, payload.content)
    if (!updated) {
      throw new ActionFailure(500, '更新评论失败')
    }
    return { comment: updated }
  },
})
