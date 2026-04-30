import { userIdSchema } from '@/server/admin-users/schema'
import { bulkDeleteCommentsForUser } from '@/server/admin-users/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: userIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    return bulkDeleteCommentsForUser(BigInt(payload.userId))
  },
})
