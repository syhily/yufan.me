import { z } from 'zod'

import { increaseLikes } from '@/server/comments/likes'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { tryLikeIncreaseRateLimit } from '@/server/rate-limit'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure, DomainError } from '@/server/route-helpers/errors'

// Wire `key` is the metric's `public_id` UUID. Validated as a string
// (Zod accepts any non-empty value); the metric lookup is the real
// existence check so an unknown UUID 404s rather than silently writing
// to a row that doesn't exist.
const inputSchema = z.object({ key: z.string().min(1) })

// IP-scoped rate limit guards the DB before we hand control to
// `increaseLikes`. The historical implementation inserted a fresh
// `like` row for every click and relied on the client-side
// `localStorage` token to support cancellation; rapidly clicking
// the heart therefore creates one row per click and a hostile
// script can blow up the table in seconds. The 429 short-circuits
// the DB write entirely — `like` row growth is now bounded by the
// configured `likeIncreaseIp` cap regardless of how the client
// behaves.
export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ ctx, payload }) {
    const limit = await tryLikeIncreaseRateLimit(ctx.clientAddress)
    if (limit.exceeded) {
      throw new DomainError('RATE_LIMITED', '点赞过于频繁，请稍后再试。')
    }
    const metricRow = await findMetricByPublicId(payload.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      throw new ActionFailure(404, '评论目标不存在')
    }
    const target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    return { ...(await increaseLikes(target)), key: payload.key }
  },
})
