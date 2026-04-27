import type { MiddlewareFunction } from 'react-router'

import { approveComment } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const action = defineApiAction({
  method: 'PATCH',
  input: commentRidSchema,
  async run({ payload }) {
    await approveComment(payload.rid)
    return null
  },
})
