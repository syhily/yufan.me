import { z } from 'zod'

import { decreaseLikes, queryLikes } from '@/server/comments/likes'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { permalinkKeySchema } from '@/server/route-helpers/permalink-key'

const inputSchema = z.object({ key: permalinkKeySchema, token: z.string().min(1) })

export const action = defineApiAction({
  method: 'DELETE',
  input: inputSchema,
  async run({ payload }) {
    await decreaseLikes(payload.key, payload.token)
    return { key: payload.key, likes: await queryLikes(payload.key) }
  },
})
