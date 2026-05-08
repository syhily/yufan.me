import { ContentCatalog } from '@/server/catalog'
import { categoryIdSchema } from '@/server/categories/schema'
import { deleteAdminCategory } from '@/server/categories/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'DELETE',
  input: categoryIdSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ok = await deleteAdminCategory(BigInt(payload.id))
    if (!ok) {
      throw new ActionFailure(404, '分类不存在')
    }
    ContentCatalog.reset()
    return { success: true } as const
  },
})
