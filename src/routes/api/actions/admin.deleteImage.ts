import { deleteImageSchema } from '@/server/images/schema'
import { deleteImage } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deleteImageSchema,
  requireAdmin: true,
  async run({ payload }) {
    await deleteImage(BigInt(payload.id))
    // The catalog hydrates cover URLs / thumbhashes from the live
    // `image` table. After a soft-delete the lookup goes from "found"
    // to "missing" — without a reset the public side keeps rendering
    // the stale thumbhash + the cache-busted URL the row used to back.
    return { success: true } as const
  },
})
