import { userSession } from '@/server/auth/primitives'
import { savePostBodySchema } from '@/server/cms/posts/schema'
import { publishLatest } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: savePostBodySchema,
  requireAdmin: true,
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const authorId = user?.id ? BigInt(user.id) : null
    const result = await publishLatest({
      postId: BigInt(payload.id),
      body: payload.body,
      expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
      force: payload.force,
      authorId,
      publishedAt: payload.publishedAt !== undefined ? new Date(payload.publishedAt) : undefined,
    })
    if (result.status === 'saved') {
    }
    return result
  },
})
