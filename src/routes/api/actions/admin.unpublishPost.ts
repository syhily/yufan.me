import { unpublishPostSchema } from '@/server/cms/posts/schema'
import { unpublishPost } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: unpublishPostSchema,
  requireAdmin: true,
  async run({ payload }) {
    const post = await unpublishPost(BigInt(payload.id))
    return { post }
  },
})
