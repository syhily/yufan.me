import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { fetchAdminUserDto } from '@/server/users/service'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const user = await fetchAdminUserDto(BigInt(payload.userId))
    if (!user) {
      throw new ActionFailure(404, '用户不存在')
    }
    return { user }
  },
})
