import { sendTestMail } from '@/server/email/sender'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { sendTestMailSchema } from '@/server/settings/schema'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: sendTestMailSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const result = await sendTestMail(payload.to)
    if (!result.ok) {
      // Surface the upstream / config status code through ActionFailure so
      // the admin UI can render a precise toast ("403 unauthorized" vs.
      // "邮件服务尚未配置完整") instead of a generic 500.
      const status =
        result.reason === 'unconfigured'
          ? 412
          : result.reason === 'upstream' && typeof result.status === 'number'
            ? result.status
            : 502
      throw new ActionFailure(status, result.message)
    }
    return { success: true as const }
  },
})
