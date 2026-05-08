import { deleteImageSchema } from '@/server/images/schema'
import { deleteImage } from '@/server/images/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: deleteImageSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    await deleteImage(BigInt(payload.id), viewer)
    // The catalog hydrates cover URLs / thumbhashes from the live
    // `image` table. After a soft-delete the lookup goes from "found"
    // to "missing" — without a reset the public side keeps rendering
    // the stale thumbhash + the cache-busted URL the row used to back.
    return { success: true } as const
  },
})
