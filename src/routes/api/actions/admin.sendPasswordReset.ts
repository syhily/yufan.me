import { z } from 'zod'

import { issueResetToken } from '@/server/auth/verification-tokens'
import { findUserById } from '@/server/db/query/user'
import { sendPasswordReset } from '@/server/email/sender'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const sendPasswordResetSchema = z.object({
  userId: z.string().min(1),
})

export const action = defineApiAction({
  method: 'POST',
  input: sendPasswordResetSchema,
  requireRole: 'admin',
  async run({ ctx, payload }) {
    const targetId = BigInt(payload.userId)
    const target = await findUserById(targetId)
    if (target === null) {
      throw new ActionFailure(404, '用户不存在。')
    }
    if (target.role === null) {
      throw new ActionFailure(400, '该用户尚未注册（匿名评论者），无法发送密码重置邮件。')
    }

    const { token } = await issueResetToken(targetId)
    const origin = ctx.url.origin
    const resetLink = `${origin}/wp-login.php?action=resetpassword&token=${token}`
    const result = await sendPasswordReset(target.email, target.name, resetLink, false)
    if (!result.ok) {
      throw new ActionFailure(500, `密码重置邮件发送失败：${result.message}`)
    }

    return { ok: true }
  },
})
