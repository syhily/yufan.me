import { deleteMusicSchema } from '@/server/music/schema'
import { deleteMusic } from '@/server/music/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: deleteMusicSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    await deleteMusic(BigInt(payload.id), { userId: ctx.session.get('user')!.id, role: ctx.session.get('user')!.role! })
    return { success: true } as const
  },
})
