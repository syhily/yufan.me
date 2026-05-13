import { recalculateThumbhashSchema } from '@/server/images/schema'
import { recalculateImageThumbhash } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: recalculateThumbhashSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const image = await recalculateImageThumbhash(BigInt(payload.id), {
      userId: ctx.session.get('user')!.id,
      role: ctx.session.get('user')!.role!,
    })
    // Thumbhash + `updatedAt` changed: invalidate the catalog so the
    // next render emits a refreshed `?v=` cache buster + the new
    // base64 thumbhash on every page that references this image as
    // a cover / poster.
    return { image }
  },
})
