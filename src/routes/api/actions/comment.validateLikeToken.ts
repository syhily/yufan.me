import { z } from 'zod'

import { validateLikeToken } from '@/server/comments/likes'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const inputSchema = z.object({ key: z.string().min(1), token: z.string().min(1) })

export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ payload }) {
    const metricRow = await findMetricByPublicId(payload.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      return { key: payload.key, valid: false }
    }
    const target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    return { key: payload.key, valid: await validateLikeToken(target, payload.token) }
  },
})
