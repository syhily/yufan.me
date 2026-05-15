import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'

export const adminSessionsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/sessions',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      responses: {
        200: z.object({ sessions: z.array(z.unknown()), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '管理后台：会话列表',
    },

    revoke: {
      method: 'POST',
      path: '/admin/sessions/:sessionId/revoke',
      pathParams: z.object({ sessionId: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean(), currentSession: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：撤销指定会话',
    },
  },
  { strictStatusCodes: true },
)
