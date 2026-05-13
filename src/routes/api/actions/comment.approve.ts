import { approveComment } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'PATCH',
  input: commentRidSchema,
  requireRole: 'admin',
  async run({ payload }) {
    await approveComment(payload.rid)
    return null
  },
})
