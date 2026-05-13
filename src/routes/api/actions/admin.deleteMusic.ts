import { deleteMusicSchema } from '@/server/music/schema'
import { deleteMusic } from '@/server/music/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: deleteMusicSchema,
  requireRole: 'author',
  async run({ payload }) {
    await deleteMusic(BigInt(payload.id))
    return { success: true } as const
  },
})
