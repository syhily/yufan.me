import { unpublishPostSchema } from '@/server/cms/posts/schema'
import { loadOwnedPostOr404, unpublishPost } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: unpublishPostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    const post = await unpublishPost(BigInt(payload.id))
    return { post }
  },
})
