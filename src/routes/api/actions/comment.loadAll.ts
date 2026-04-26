import { loadAllComments } from '@/server/comments/admin'
import { loadAllCommentsSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: loadAllCommentsSchema,
  requireAdmin: true,
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
