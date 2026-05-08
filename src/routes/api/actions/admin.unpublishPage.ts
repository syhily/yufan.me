import { ContentCatalog } from '@/server/catalog'
import { unpublishPageSchema } from '@/server/cms/pages/schema'
import { unpublishPage } from '@/server/cms/pages/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Take a previously published page offline. Flips
// `meta.published = false` while leaving the latest published revision
// content intact, so a future "发布" promotes it back without writing
// an empty no-op revision. The catalog snapshot is reset so the
// public site reflects the change on the next render.
export const action = defineApiAction({
  method: 'POST',
  input: unpublishPageSchema,
  requireAdmin: true,
  async run({ payload }) {
    const page = await unpublishPage(BigInt(payload.id))
    ContentCatalog.reset()
    return { page }
  },
})
