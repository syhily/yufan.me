import { z } from 'zod'

import { loadImageThumbhash } from '@/server/images/render-enhance'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const resolveThumbhashSchema = z.object({
  src: z.string().trim().min(1).max(2000),
})

export const loader = defineApiAction({
  method: 'GET',
  input: resolveThumbhashSchema,
  async run({ payload }) {
    const image = await loadImageThumbhash(payload.src)
    return {
      thumbhash: image?.thumbhash ?? null,
      width: image?.width ?? null,
      height: image?.height ?? null,
    }
  },
})
