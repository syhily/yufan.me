import { z } from 'zod'

import { issueSetupToken } from '@/server/auth/verification-tokens'
import { insertAuthor, findUserByEmail } from '@/server/db/query/user'
import { sendAuthorInvite } from '@/server/email/sender'
import { tryKeyedRateLimit } from '@/server/rate-limit'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const inviteAuthorSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
})

// Per-admin per-email: 1 invite per hour.
const INVITE_RATE_BUCKET = { maxAttempts: 1, windowSeconds: 3600 }

export const action = defineApiAction({
  method: 'POST',
  input: inviteAuthorSchema,
  requireRole: 'admin',
  async run({ ctx, payload }) {
    const adminId = ctx.session.get('user')?.id ?? 'anon'
    const key = `rate-limit:invite:${adminId}:${payload.email.toLowerCase()}`
    const limit = await tryKeyedRateLimit(key, INVITE_RATE_BUCKET)
    if (limit.exceeded) {
      throw new ActionFailure(429, '邀请邮件发送过于频繁，请稍后再试。')
    }

    const existing = await findUserByEmail(payload.email)
    if (existing !== null) {
      throw new ActionFailure(409, '该邮箱已被注册。')
    }

    const author = await insertAuthor(payload.name, payload.email)
    const { token } = await issueSetupToken(author.id)

    const origin = ctx.url.origin
    const acceptLink = `${origin}/wp-login.php?action=accept-invite&token=${token}`

    const inviterName = ctx.session.get('user')?.name ?? '管理员'
    const result = await sendAuthorInvite(payload.email, payload.name, inviterName, acceptLink)
    if (!result.ok) {
      throw new ActionFailure(500, `邀请邮件发送失败：${result.message}`)
    }

    return { authorId: String(author.id) }
  },
})
