import { userIdSchema } from '@/server/admin-users/schema'
import { restoreAdminUser } from '@/server/admin-users/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: userIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ok = await restoreAdminUser(BigInt(payload.userId))
    if (!ok) throw new ActionFailure(404, '用户不存在')
    return { success: true } as const
  },
})
