import { userIdSchema } from '@/server/admin-users/schema'
import { fetchAdminUserDto } from '@/server/admin-users/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: userIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const user = await fetchAdminUserDto(BigInt(payload.userId))
    if (!user) throw new ActionFailure(404, '用户不存在')
    return { user }
  },
})
