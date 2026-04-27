import type { MiddlewareFunction } from 'react-router'

import { loadAllComments } from '@/server/comments/admin'
import { loadAllCommentsSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const action = defineApiAction({
  method: 'POST',
  input: loadAllCommentsSchema,
  async run({ payload }) {
    const result = await loadAllComments(
      payload.offset,
      payload.limit,
      payload.pageKey,
      payload.userId ? BigInt(payload.userId) : undefined,
      payload.status,
    )
    return {
      comments: result.comments,
      total: result.total,
      hasMore: result.hasMore,
    }
  },
})
