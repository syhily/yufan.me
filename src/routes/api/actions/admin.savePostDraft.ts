import { savePostBodySchema } from '@/server/cms/posts/schema'
import { loadOwnedPostOr404, saveDraft } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: savePostBodySchema,
  requireRole: 'author',
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    const authorId = user?.id ? BigInt(user.id) : null
    await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    return saveDraft({
      postId: BigInt(payload.id),
      body: payload.body,
      expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
      force: payload.force,
      authorId,
    })
  },
})
