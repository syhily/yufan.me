import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { muteUserSchema } from '@/server/users/schema'
import { fetchAdminUserDto, muteAdminUser } from '@/server/users/service'

export const action = defineGuardedApiAction({
  method: 'PATCH',
  input: muteUserSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const updated = await muteAdminUser(BigInt(payload.userId), payload.muted)
    if (!updated) {
      throw new ActionFailure(404, '用户不存在或为管理员（管理员不可禁言）')
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) {
      throw new ActionFailure(404, '用户不存在')
    }
    return { user: dto }
  },
})
