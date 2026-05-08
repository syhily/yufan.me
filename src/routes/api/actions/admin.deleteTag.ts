import { ContentCatalog } from '@/server/catalog'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'
import { tagIdSchema } from '@/server/tags/schema'
import { deleteAdminTag } from '@/server/tags/service'

export const action = defineApiAction({
  method: 'DELETE',
  input: tagIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ok = await deleteAdminTag(BigInt(payload.id))
    if (!ok) {
      throw new ActionFailure(404, '标签不存在')
    }
    ContentCatalog.reset()
    return { success: true } as const
  },
})
