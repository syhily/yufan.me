import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ ctx, payload, viewer }) {
    const dbUser = await findUserById(BigInt(viewer.userId))
    if (!dbUser) {
      throw new ActionFailure(404, '用户不存在。')
    }
    const ok = await bcrypt.compare(payload.oldPassword, dbUser.password)
    if (!ok) {
      throw new ActionFailure(403, '原密码错误。')
    }
    const hashed = await bcrypt.hash(payload.newPassword, 12)
    await updateUserById(dbUser.id, { password: hashed })
    // Keep the current session alive — the caller is presumably on the
    // tab that initiated the change. Revoke every OTHER session so
    // stolen-cookie attacks lose access immediately.
    await revokeAllSessionsOfUser(dbUser.id, ctx.session.id)
    return { success: true }
  },
})
