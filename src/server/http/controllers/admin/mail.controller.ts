import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminMailContract } from '@/shared/contracts/admin/mail'

import { sendTestMail } from '@/server/email/sender'
import { ok } from '@/server/http/response'
import { body } from '@/server/http/ts-rest-adapter'

interface SendTestMailBody {
  to: string
}

export const adminMailController: ContractImpl<typeof adminMailContract> = {
  sendTest: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<SendTestMailBody>(args)
    const result = await sendTestMail(b.to)
    if (!result.ok) {
      const status =
        result.reason === 'unconfigured'
          ? 412
          : result.reason === 'upstream' && typeof result.status === 'number'
            ? result.status
            : 502
      return { status, body: { error: { message: result.message } } }
    }
    return ok({ success: true })
  },
}
