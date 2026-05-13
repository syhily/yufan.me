import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { restoreAdminUser } from '@/server/users/service'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const ok = await restoreAdminUser(BigInt(payload.userId))
    if (!ok) {
      throw new ActionFailure(404, '用户不存在')
    }
    return { success: true } as const
  },
})
