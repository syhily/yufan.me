import { deleteImageSchema } from '@/server/images/schema'
import { deleteImage } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deleteImageSchema,
  requireAdmin: true,
  async run({ payload }) {
    await deleteImage(BigInt(payload.id))
    return { success: true } as const
  },
})
