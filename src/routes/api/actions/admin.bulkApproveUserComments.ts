import { defineApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { bulkApproveCommentsForUser } from '@/server/users/service'

export const action = defineApiAction({
  method: 'POST',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload }) {
    return bulkApproveCommentsForUser(BigInt(payload.userId))
  },
})
