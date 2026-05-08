import { deleteComment } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'DELETE',
  input: commentRidSchema,
  requireRole: 'admin',
  async run({ payload }) {
    await deleteComment(payload.rid)
    return null
  },
})
