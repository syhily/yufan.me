import { z } from 'zod'

import { increaseLikes } from '@/server/comments/likes'
import { tryLikeIncreaseRateLimit } from '@/server/rate-limit'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { DomainError } from '@/server/route-helpers/errors'
import { permalinkKeySchema } from '@/server/route-helpers/permalink-key'

const inputSchema = z.object({ key: permalinkKeySchema })

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
    return { ...(await increaseLikes(payload.key)), key: payload.key }
  },
})
