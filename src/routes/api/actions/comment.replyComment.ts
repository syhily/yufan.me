import { createComment } from '@/server/comments/loader'
import { commentReplySchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Accepts either form-encoded (`<fetcher.Form>` submissions from the public
// reply UI, the canonical channel after the React Router migration) or JSON
// bodies (admin reply card still posts JSON). Dispatching on
// `Content-Type` per request keeps the same endpoint working for both shapes.
export const action = defineApiAction({
  method: 'POST',
  input: commentReplySchema,
  inputSource: 'auto',
  run: async ({ ctx, payload }) => {
    const comment = await createComment(payload, ctx.request, ctx.clientAddress, ctx.session)
    return { comment }
  },
})
