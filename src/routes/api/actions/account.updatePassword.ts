import { z } from 'zod'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { updateUserPasswordById, verifyUserPasswordById } from '@/server/db/query/user'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export const action = defineApiAction({
  method: 'POST',
  input: updatePasswordSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')

    if (payload.oldPassword === payload.newPassword) {
      throw new ActionFailure(400, '新密码不能与旧密码相同。')
    }

    const verified = await verifyUserPasswordById(userId, payload.oldPassword)
    if (!verified) {
      throw new ActionFailure(403, '旧密码不正确。')
    }

    await updateUserPasswordById(userId, payload.newPassword)
    await revokeAllSessionsOfUser(userId)

    return { ok: true }
  },
})
