import { restorePageSchema } from '@/server/cms/pages/schema'
import { restorePage } from '@/server/cms/pages/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

// Restore a soft-deleted page (clears `deletedAt`). 404 when the row
// is missing or already live (`deletedAt IS NULL`) so a double-click
// doesn't silently no-op on an already-active row.
export const action = defineApiAction({
  method: 'POST',
  input: restorePageSchema,
  requireAdmin: true,
  async run({ payload }) {
    const result = await restorePage(BigInt(payload.id))
    if (!result.restored) {
      throw new ActionFailure(404, '页面不存在或未被删除。')
    }
    return { success: true } as const
  },
})
