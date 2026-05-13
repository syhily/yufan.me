import { deletePageSchema } from '@/server/cms/pages/schema'
import { deletePage } from '@/server/cms/pages/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

// Soft-delete: the row stays in the database with `deletedAt = now()`
// so admin can restore it. Public catalog already excludes
// soft-deleted rows; the in-process catalog snapshot is invalidated
// so the next public render reflects the deletion.
export const action = defineApiAction({
  method: 'DELETE',
  input: deletePageSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const result = await deletePage(BigInt(payload.id))
    if (!result.deleted) {
      throw new ActionFailure(404, '页面不存在或已被删除。')
    }
    return { success: true } as const
  },
})
