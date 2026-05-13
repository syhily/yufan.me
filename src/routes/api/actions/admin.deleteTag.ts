import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'
import { tagIdSchema } from '@/server/tags/schema'
import { deleteAdminTag } from '@/server/tags/service'

export const action = defineApiAction({
  method: 'DELETE',
  input: tagIdSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const ok = await deleteAdminTag(BigInt(payload.id), viewer)
    if (!ok) {
      throw new ActionFailure(404, '标签不存在')
    }
    return { success: true } as const
  },
})
