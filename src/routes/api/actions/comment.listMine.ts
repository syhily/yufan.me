import { z } from 'zod'

import { listMyComments } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const listMyCommentsSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const loader = defineApiAction({
  method: 'GET',
  input: listMyCommentsSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')
    const { rows, total } = await listMyComments(userId, { offset: payload.offset, limit: payload.limit })
    return {
      comments: rows.map((c) => ({
        id: String(c.id),
        content: c.content,
        body: c.body,
        createdAt: c.createAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        type: c.type,
        ownerId: String(c.ownerId),
        isPending: c.isPending,
        isPinned: c.isPinned,
        rid: Number(c.rid),
        rootId: c.rootId === null ? null : String(c.rootId),
        voteUp: Number(c.voteUp ?? 0),
        voteDown: Number(c.voteDown ?? 0),
        deleteRequestedAt: c.deleteRequestedAt?.toISOString() ?? null,
      })),
      total,
      hasMore: payload.offset + rows.length < total,
    }
  },
})
