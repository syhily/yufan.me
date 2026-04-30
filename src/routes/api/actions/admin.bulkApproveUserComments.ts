import { userIdSchema } from '@/server/admin-users/schema'
import { bulkApproveCommentsForUser } from '@/server/admin-users/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: userIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    return bulkApproveCommentsForUser(BigInt(payload.userId))
  },
})
