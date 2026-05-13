import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { bulkDeleteCommentsForUser } from '@/server/users/service'

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    return bulkDeleteCommentsForUser(BigInt(payload.userId))
  },
})
