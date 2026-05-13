import { upsertPageMetaSchema } from '@/server/cms/pages/schema'
import { createPage, updatePageMeta } from '@/server/cms/pages/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

// Single endpoint for both create + update (mirrors the upsertCategory
// style). `id` absent → create; present → update. The metadata write
// invalidates the in-process catalog so the next public render +
// thumbhash hydration pick up the new slug/title/cover/published flag.
export const action = defineGuardedApiAction({
  method: 'POST',
  input: upsertPageMetaSchema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    const sessionUserId = BigInt(viewer.userId)
    const meta = {
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary,
      cover: payload.cover,
      og: payload.og,
      published: payload.published,
      commentsEnabled: payload.commentsEnabled,
      showToc: payload.showToc,
      showUpdated: payload.showUpdated,
      showFriends: payload.showFriends,
      publishedAt: payload.publishedAt === undefined ? undefined : new Date(payload.publishedAt),
    }
    const page =
      payload.id === undefined
        ? await createPage(meta, sessionUserId)
        : await updatePageMeta({ id: BigInt(payload.id), ...meta })
    return { page }
  },
})
