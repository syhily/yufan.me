import { unpublishPostSchema } from '@/server/cms/posts/schema'
import { unpublishPost } from '@/server/cms/posts/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: unpublishPostSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const post = await unpublishPost(BigInt(payload.id), viewer)
    return { post }
  },
})
