import { ContentCatalog } from '@/server/catalog'
import { friendIdSchema } from '@/server/friends/schema'
import { deleteAdminFriend } from '@/server/friends/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: friendIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ok = await deleteAdminFriend(BigInt(payload.id))
    if (!ok) {
      throw new ActionFailure(404, '友链不存在')
    }
    ContentCatalog.reset()
    return { success: true } as const
  },
})
