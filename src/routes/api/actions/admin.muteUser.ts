import { muteUserSchema } from '@/server/admin-users/schema'
import { fetchAdminUserDto, muteAdminUser } from '@/server/admin-users/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'PATCH',
  input: muteUserSchema,
  requireAdmin: true,
  async run({ payload }) {
    const updated = await muteAdminUser(BigInt(payload.userId), payload.muted)
    if (!updated) {
      throw new ActionFailure(404, '用户不存在或为管理员（管理员不可禁言）')
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) throw new ActionFailure(404, '用户不存在')
    return { user: dto }
  },
})
