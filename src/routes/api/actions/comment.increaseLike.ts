import { z } from 'zod'

import { increaseLikes } from '@/server/comments/likes'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { permalinkKeySchema } from '@/server/route-helpers/permalink-key'

const inputSchema = z.object({ key: permalinkKeySchema })

export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ payload }) {
    return { ...(await increaseLikes(payload.key)), key: payload.key }
  },
})
