import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { userSession } from '@/server/auth/primitives'
import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const dbUser = await findUserById(BigInt(user!.id))
    if (!dbUser) {
      throw new ActionFailure(404, '用户不存在。')
    }
    const ok = await bcrypt.compare(payload.oldPassword, dbUser.password)
    if (!ok) {
      throw new ActionFailure(403, '原密码错误。')
    }
    const hashed = await bcrypt.hash(payload.newPassword, 12)
    await updateUserById(dbUser.id, { password: hashed })
    await revokeAllSessionsOfUser(dbUser.id)
    return { success: true }
  },
})
