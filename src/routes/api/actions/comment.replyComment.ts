import { createComment } from '@/server/comments/loader'
import { commentReplySchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: commentReplySchema,
  async run({ ctx, payload }) {
    const comment = await createComment(payload, ctx.request, ctx.clientAddress, ctx.session)
    return { comment }
  },
})
