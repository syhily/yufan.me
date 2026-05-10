import { userSession } from '@/server/auth/primitives'
import { ContentCatalog } from '@/server/catalog'
import { upsertPostMetaSchema } from '@/server/cms/posts/schema'
import { createPost, updatePostMeta } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: upsertPostMetaSchema,
  requireAdmin: true,
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const sessionUserId = user?.id ? BigInt(user.id) : null
    const meta = {
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary,
      cover: payload.cover,
      og: payload.og,
      published: payload.published,
      commentsEnabled: payload.commentsEnabled,
      showToc: payload.showToc,
      visible: payload.visible,
      category: payload.category,
      tags: payload.tags,
      alias: payload.alias,
      publishedAt: payload.publishedAt === undefined ? undefined : new Date(payload.publishedAt),
    }
    const post =
      payload.id === undefined
        ? await createPost(meta, sessionUserId)
        : await updatePostMeta({ id: BigInt(payload.id), ...meta })
    ContentCatalog.reset()
    return { post }
  },
})
