import { z } from 'zod'

import { countMyComments, listMyComments } from '@/server/db/query/comment'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

const schema = z.object({
  offset: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
})

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: schema,
  requireRole: 'visitor',
  async run({ payload, viewer }) {
    const userId = BigInt(viewer.userId)
    const offset = payload.offset ?? 0
    const limit = Math.min(payload.limit ?? 20, 100)
    const [comments, counts] = await Promise.all([listMyComments(userId, offset, limit), countMyComments(userId)])
    return {
      comments,
      total: counts.total,
      pending: counts.pending,
      deleteRequested: counts.deleteRequested,
      hasMore: offset + comments.length < counts.total,
    }
  },
})
