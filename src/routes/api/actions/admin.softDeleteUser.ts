import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { softDeleteAdminUser } from '@/server/users/service'

export const action = defineApiAction({
  method: 'DELETE',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const ok = await softDeleteAdminUser(BigInt(payload.userId))
    if (!ok) {
      throw new ActionFailure(404, '用户不存在或已被删除')
    }
    return { success: true } as const
  },
})
