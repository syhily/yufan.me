import { z } from 'zod'

import { validateLikeToken } from '@/server/comments/likes'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { permalinkKeySchema } from '@/server/route-helpers/permalink-key'

const inputSchema = z.object({ key: permalinkKeySchema, token: z.string().min(1) })

export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ payload }) {
    return { key: payload.key, valid: await validateLikeToken(payload.key, payload.token) }
  },
})
