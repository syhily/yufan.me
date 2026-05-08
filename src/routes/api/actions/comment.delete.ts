import { deleteComment } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: commentRidSchema,
  requireAdmin: true,
  async run({ payload }) {
    await deleteComment(payload.rid)
    return null
  },
})
