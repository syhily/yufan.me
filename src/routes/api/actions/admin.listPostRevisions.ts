import { listPostRevisionsSchema } from '@/server/cms/posts/schema'
import { listRevisionsForAdmin } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listPostRevisionsSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const revisions = await listRevisionsForAdmin(BigInt(payload.id), viewer)
    return { revisions }
  },
})
