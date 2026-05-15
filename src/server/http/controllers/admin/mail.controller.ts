import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { sendTestMail } from '@/server/email/sender'
import { adminProc } from '@/server/http/orpc-base'

const sendTest = adminProc
  .input(z.object({ to: z.email() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    const result = await sendTestMail(input.to)
    if (!result.ok) {
      if (result.reason === 'unconfigured') {
        throw new ORPCError('BAD_REQUEST', { message: result.message })
      }
      if (result.reason === 'upstream') {
        throw new ORPCError('BAD_GATEWAY', { message: result.message })
      }
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: result.message })
    }
    return { success: true }
  })

export const adminMailRouter = { sendTest }
