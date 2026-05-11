import { z } from 'zod'

import { decreaseLikes, queryLikes } from '@/server/comments/likes'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const inputSchema = z.object({ key: z.string().min(1), token: z.string().min(1) })

export const action = defineApiAction({
  method: 'DELETE',
  input: inputSchema,
  async run({ payload }) {
    const metricRow = await findMetricByPublicId(payload.key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      throw new ActionFailure(404, '评论目标不存在')
    }
    const target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    await decreaseLikes(target, payload.token)
    return { key: payload.key, likes: await queryLikes(target) }
  },
})
