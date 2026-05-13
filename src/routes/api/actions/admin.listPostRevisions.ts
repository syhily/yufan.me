import { listPostRevisionsSchema } from '@/server/cms/posts/schema'
import { listRevisionsForAdmin } from '@/server/cms/posts/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: listPostRevisionsSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const revisions = await listRevisionsForAdmin(BigInt(payload.id), viewer)
    return { revisions }
  },
})
