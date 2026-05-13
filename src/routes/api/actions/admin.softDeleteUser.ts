import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { countAdmins, findUserById } from '@/server/db/query/user'
import { getLogger } from '@/server/logger'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { softDeleteAdminUser } from '@/server/users/service'

const log = getLogger('audit.user')

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    if (viewer.userId === payload.userId) {
      throw new ActionFailure(403, '不能删除自己。')
    }
    const targetId = BigInt(payload.userId)
    const target = await findUserById(targetId)
    if (!target) {
      throw new ActionFailure(404, '用户不存在')
    }
    // Mirror of the updateUserRole safeguard: deleting the only admin
    // leaves the site with no one able to manage it.
    if (target.role === 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        throw new ActionFailure(409, '不能删除唯一的管理员。')
      }
    }
    const ok = await softDeleteAdminUser(targetId)
    if (!ok) {
      throw new ActionFailure(404, '用户不存在或已被删除')
    }
    // Privilege-changing mutation: revoke every session the target
    // user currently holds so a stolen cookie doesn't survive the
    // delete.
    await revokeAllSessionsOfUser(targetId)
    log.info('user soft deleted', { actor: viewer.userId, target: payload.userId, role: target.role })
    return { success: true } as const
  },
})
