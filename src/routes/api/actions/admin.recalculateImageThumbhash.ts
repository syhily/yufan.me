import { recalculateThumbhashSchema } from '@/server/images/schema'
import { recalculateImageThumbhash } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: recalculateThumbhashSchema,
  requireAdmin: true,
  async run({ payload }) {
    const image = await recalculateImageThumbhash(BigInt(payload.id))
    return { image }
  },
})
