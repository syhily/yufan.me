import { z } from 'zod'

import { issueSetupToken } from '@/server/auth/verification-tokens'
import { findUserByEmail, insertAuthor } from '@/server/db/query/user'
import { sendAuthorInvite } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { tryInviteRateLimit } from '@/server/rate-limit'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.user')

const schema = z.object({
  name: z.string().min(1).max(50),
  email: z.email(),
})

export const action = defineApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ ctx, payload, viewer }) {
    const existing = await findUserByEmail(payload.email)
    if (existing !== null) {
      throw new ActionFailure(409, '该邮箱已被注册。')
    }
    const limit = await tryInviteRateLimit(ctx.clientAddress)
    if (limit.exceeded) {
      throw new ActionFailure(429, '邀请发送过于频繁，请稍后再试。')
    }
    const [user] = await insertAuthor(payload.name, payload.email)
    if (!user) {
      throw new ActionFailure(500, '创建作者账户失败。')
    }
    const { token } = await issueSetupToken(Number(user.id))
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=accept-invite&token=${encodeURIComponent(token)}`
    const inviter = ctx.session.get('user')?.name ?? '管理员'
    await sendAuthorInvite(user, link, inviter)
    log.info('author invited', { actor: viewer.userId, target: String(user.id), email: payload.email })
    return { success: true }
  },
})
