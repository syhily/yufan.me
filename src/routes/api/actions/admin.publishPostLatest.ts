import { savePostBodySchema } from '@/server/cms/posts/schema'
import { publishLatest } from '@/server/cms/posts/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineGuardedApiAction({
  method: 'POST',
  input: savePostBodySchema,
  requireRole: 'author',
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload, viewer }) {
    return publishLatest(
      {
        postId: BigInt(payload.id),
        body: payload.body,
        expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
        force: payload.force,
        authorId: BigInt(viewer.userId),
        publishedAt: payload.publishedAt !== undefined ? new Date(payload.publishedAt) : undefined,
      },
      viewer,
    )
  },
})
