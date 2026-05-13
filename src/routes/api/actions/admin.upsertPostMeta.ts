import { upsertPostMetaSchema } from '@/server/cms/posts/schema'
import { createPost, updatePostMeta } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: upsertPostMetaSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
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
      visible: payload.visible,
      category: payload.category,
      tags: payload.tags,
      alias: payload.alias,
      pinnedAt:
        payload.pinnedAt === undefined || payload.pinnedAt === null ? payload.pinnedAt : new Date(payload.pinnedAt),
      publishedAt: payload.publishedAt === undefined ? undefined : new Date(payload.publishedAt),
    }
    const sessionUserId = BigInt(viewer.userId)
    const post =
      payload.id === undefined
        ? await createPost(meta, sessionUserId, viewer)
        : await updatePostMeta({ id: BigInt(payload.id), ...meta }, viewer)
    return { post }
  },
})
