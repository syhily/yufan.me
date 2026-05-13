import { z } from 'zod'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { countAdmins, findUserById, updateUserRole } from '@/server/db/query/user'
import { getLogger } from '@/server/logger'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.user')

const schema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'author', 'visitor']),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    if (viewer.userId === payload.userId) {
      throw new ActionFailure(403, '不能修改自己的角色。')
    }
    const targetId = BigInt(payload.userId)
    const target = await findUserById(targetId)
    if (!target) {
      throw new ActionFailure(404, '用户不存在。')
    }
    if (target.role === 'admin' && payload.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        throw new ActionFailure(409, '不能降级唯一的管理员。')
      }
    }
    const updated = await updateUserRole(targetId, payload.role)
    if (updated) {
      await revokeAllSessionsOfUser(targetId)
      log.info('user role changed', {
        actor: viewer.userId,
        target: payload.userId,
        from: target.role,
        to: payload.role,
      })
    }
    return { user: updated }
  },
})
