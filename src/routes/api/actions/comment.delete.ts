import type { MiddlewareFunction } from 'react-router'

import { deleteComment } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const action = defineApiAction({
  method: 'DELETE',
  input: commentRidSchema,
  async run({ payload }) {
    await deleteComment(payload.rid)
    return null
  },
})
