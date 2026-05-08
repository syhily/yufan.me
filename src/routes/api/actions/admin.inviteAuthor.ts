import { z } from 'zod'

import { issueSetupToken, revokeTokensFor } from '@/server/auth/verification-tokens'
import { findUserByEmail, insertAuthor, softDeleteUserById } from '@/server/db/query/user'
import { sendAuthorInvite } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { tryInviteByEmailRateLimit, tryInviteRateLimit } from '@/server/rate-limit'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.user')

const schema = z.object({
  name: z.string().min(1).max(50),
  email: z.email(),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ ctx, payload, viewer }) {
    const existing = await findUserByEmail(payload.email)
    if (existing !== null) {
      throw new ActionFailure(409, '该邮箱已被注册。')
    }
    // Per-IP and per-(adminId, target email) buckets are additive — a
    // 429 from either path closes the door without leaking which one
    // tripped. `viewer.userId` is the string form of the admin's bigint
    // id; cast back here so the key path stays a clean numeric segment.
    const ipLimit = await tryInviteRateLimit(ctx.clientAddress)
    const emailLimit = await tryInviteByEmailRateLimit(BigInt(viewer.userId), payload.email)
    if (ipLimit.exceeded || emailLimit.exceeded) {
      throw new ActionFailure(429, '邀请发送过于频繁，请稍后再试。')
    }
    const [user] = await insertAuthor(payload.name, payload.email)
    if (!user) {
      throw new ActionFailure(500, '创建作者账户失败。')
    }

    // Order: issue token → send email → on email failure, roll back both
    // the token and the freshly-created user row. Without rollback an
    // SMTP outage would leave a phantom row blocking retry with
    // "邮箱已被注册".
    const { token } = await issueSetupToken(user.id)
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=accept-invite&token=${encodeURIComponent(token)}`
    const inviterSession = ctx.session.get('user')
    const inviter = inviterSession?.name ?? '管理员'

    const sendResult = await sendAuthorInvite(user, link, inviter, inviterSession?.email)
    if (!sendResult.ok) {
      await revokeTokensFor(user.id, 'author-invite')
      await softDeleteUserById(user.id)
      log.warn('author invite rolled back: email send failed', {
        actor: viewer.userId,
        target: String(user.id),
        email: payload.email,
        reason: sendResult.reason,
        message: sendResult.message,
      })
      throw new ActionFailure(502, `邮件发送失败，已回滚账户创建：${sendResult.message}`)
    }
    log.info('author invited', { actor: viewer.userId, target: String(user.id), email: payload.email })
    return { success: true }
  },
})
