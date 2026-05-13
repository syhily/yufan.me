import { listPostRevisionsSchema } from '@/server/cms/posts/schema'
import { listRevisionsForAdmin, loadOwnedPostOr404 } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listPostRevisionsSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    const revisions = await listRevisionsForAdmin(BigInt(payload.id))
    return { revisions }
  },
})
