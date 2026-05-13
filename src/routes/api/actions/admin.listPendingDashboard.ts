import { z } from 'zod'

import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

// Welcome-page admin moderation inbox: pending approvals + delete
// requests in one list with a tab discriminator.
const schema = z.object({
  kind: z.enum(['all', 'approval', 'deletion']).default('all'),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(5),
})

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: schema,
  requireRole: 'admin',
  async run({ payload }) {
    return loadAdminPendingDashboard(payload.kind, payload.offset, payload.limit)
  },
})
