import { z } from 'zod'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { countAdmins, findUserById, updateUserRole } from '@/server/db/query/user'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'author', 'visitor']),
})

export const action = defineApiAction({
  method: 'POST',
  input: updateUserRoleSchema,
  requireRole: 'admin',
  async run({ ctx, payload }) {
    const targetId = BigInt(payload.userId)
    const selfId = ctx.session.get('user')?.id

    // Cannot change your own role.
    if (selfId !== undefined && targetId.toString() === selfId) {
      throw new ActionFailure(403, '不能修改自己的角色。')
    }

    const target = await findUserById(targetId)
    if (target === null) {
      throw new ActionFailure(404, '用户不存在。')
    }

    // Prevent demoting the last admin.
    if (target.role === 'admin' && payload.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        throw new ActionFailure(409, '不能降级唯一的管理员。请先将另一位用户提升为管理员。')
      }
    }

    const updated = await updateUserRole(targetId, payload.role)
    if (updated === null) {
      throw new ActionFailure(500, '更新角色失败。')
    }

    // Revoke all sessions so the user re-logs with the new role.
    await revokeAllSessionsOfUser(targetId)

    return { userId: String(updated.id), role: updated.role }
  },
})
