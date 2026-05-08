import { listPageRevisionsSchema } from '@/server/cms/pages/schema'
import { listRevisionsForAdmin } from '@/server/cms/pages/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Read-only revision history for the editor's right-pane drawer.
// Returns every revision (draft and published) for a single page,
// most recent first.
export const loader = defineApiAction({
  method: 'GET',
  input: listPageRevisionsSchema,
  requireAdmin: true,
  async run({ payload }) {
    const revisions = await listRevisionsForAdmin(BigInt(payload.id))
    return { revisions }
  },
})
