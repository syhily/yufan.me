import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { sendTestMail } from '@/server/email/sender'
import { userSession } from '@/server/session'
import { adminMailContract } from '@/shared/contracts/admin/mail'

export const adminMailController: ContractImpl<typeof adminMailContract> = {
  sendTestMail: async (args: any, ctx: any) => {
    const payload = args.body
    const result = await sendTestMail(payload.to)
    if (!result.ok) {
      if (result.reason === 'unconfigured') {
        return { status: 400 as const, body: { error: { message: result.message } } }
      }
      if (result.reason === 'upstream') {
        return { status: 502 as const, body: { error: { message: result.message } } }
      }
      return { status: 500 as const, body: { error: { message: result.message } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
}
