import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

export const adminMailContract = c.router(
  {
    sendTestMail: {
      method: 'POST',
      path: '/admin/send-test-mail',
      body: z.any() /* TODO: use sendTestMailSchema */,
      responses: {
        200: z.any(),
        502: z.object({ error: z.object({ message: z.string() }) }),
        ...standardMutationErrors,
      },
      summary: 'sendTestMail',
    },
  },
  { strictStatusCodes: true },
)
