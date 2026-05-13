import { z } from 'zod'

import { userSession } from '@/server/auth/primitives'
import { countMyComments, listMyComments } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const schema = z.object({
  offset: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
})

export const loader = defineApiAction({
  method: 'GET',
  input: schema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const userId = BigInt(user!.id)
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
