import { unpublishPostSchema } from '@/server/cms/posts/schema'
import { unpublishPost } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: unpublishPostSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const post = await unpublishPost(BigInt(payload.id), {
      userId: ctx.session.get('user')!.id,
      role: ctx.session.get('user')!.role!,
    })
    return { post }
  },
})
