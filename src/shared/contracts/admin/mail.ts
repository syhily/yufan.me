import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

export const adminMailContract = c.router(
  {
    sendTest: {
      method: 'POST',
      path: '/admin/mail/test',
      body: z.object({ to: z.email() }),
      responses: {
        200: z.object({ success: z.boolean() }),
        502: z.object({ error: z.object({ message: z.string() }) }),
        ...standardMutationErrors,
      },
      summary: '管理后台：发送测试邮件',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
