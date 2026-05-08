import { friendIdSchema } from '@/server/friends/schema'
import { deleteAdminFriend } from '@/server/friends/service'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: friendIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const ok = await deleteAdminFriend(BigInt(payload.id))
    if (!ok) {
      throw new ActionFailure(404, '友链不存在')
    }
    return { success: true } as const
  },
})
