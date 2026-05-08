import { recalculateThumbhashSchema } from '@/server/images/schema'
import { recalculateImageThumbhash } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: recalculateThumbhashSchema,
  requireAdmin: true,
  async run({ payload }) {
    const image = await recalculateImageThumbhash(BigInt(payload.id))
    // Thumbhash + `updatedAt` changed: invalidate the catalog so the
    // next render emits a refreshed `?v=` cache buster + the new
    // base64 thumbhash on every page that references this image as
    // a cover / poster.
    return { image }
  },
})
