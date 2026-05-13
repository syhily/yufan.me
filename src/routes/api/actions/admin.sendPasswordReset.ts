import { z } from 'zod'

import { issueResetToken } from '@/server/auth/verification-tokens'
import { findUserById } from '@/server/db/query/user'
import { sendPasswordReset } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.user')

const schema = z.object({
  userId: z.string(),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ ctx, payload, viewer }) {
    const user = await findUserById(BigInt(payload.userId))
    if (!user) {
      throw new ActionFailure(404, '用户不存在。')
    }
    const { token } = await issueResetToken(Number(user.id))
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
    await sendPasswordReset(user, link)
    log.info('password reset sent', { actor: viewer.userId, target: payload.userId })
    return { success: true }
  },
})
