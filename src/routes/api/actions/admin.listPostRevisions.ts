import { listPostRevisionsSchema } from '@/server/cms/posts/schema'
import { listRevisionsForAdmin } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listPostRevisionsSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    const revisions = await listRevisionsForAdmin(BigInt(payload.id), { userId: user!.id, role: user!.role! })
    return { revisions }
  },
})
