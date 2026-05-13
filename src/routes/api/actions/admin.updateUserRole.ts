import { z } from 'zod'

import { userSession } from '@/server/auth/primitives'
import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { countAdmins, findUserById, updateUserRole } from '@/server/db/query/user'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'author', 'visitor']),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireAdmin: true,
  async run({ ctx, payload }) {
    const self = userSession(ctx.session)
    const targetId = BigInt(payload.userId)
    if (self!.id === payload.userId) {
      throw new ActionFailure(403, '不能修改自己的角色。')
    }
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
    }
    return { user: updated }
  },
})
