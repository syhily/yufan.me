import { userIdSchema } from '@/server/admin-users/schema'
import { softDeleteAdminUser } from '@/server/admin-users/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: userIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ok = await softDeleteAdminUser(BigInt(payload.userId))
    if (!ok) throw new ActionFailure(404, '用户不存在或已被删除')
    return { success: true } as const
  },
})
