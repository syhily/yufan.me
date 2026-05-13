import { z } from 'zod'

import { issueResetToken } from '@/server/auth/verification-tokens'
import { findUserById } from '@/server/db/query/user'
import { sendPasswordReset } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { tryPasswordResetByTargetRateLimit } from '@/server/rate-limit'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.user')

const schema = z.object({
  userId: z.string(),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ ctx, payload, viewer }) {
    const targetId = BigInt(payload.userId)
    const user = await findUserById(targetId)
    if (!user) {
      throw new ActionFailure(404, '用户不存在。')
    }
    // Per-target throttle: prevents a compromised admin cookie (or a
    // rage-click) from carpet-bombing one mailbox.
    const limit = await tryPasswordResetByTargetRateLimit(targetId)
    if (limit.exceeded) {
      throw new ActionFailure(429, '该用户的重置邮件发送过于频繁，请稍后再试。')
    }
    const { token } = await issueResetToken(user.id)
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
    await sendPasswordReset(user, link)
    log.info('password reset sent', { actor: viewer.userId, target: payload.userId })
    return { success: true }
  },
})
