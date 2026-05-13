import { upsertPostMetaSchema } from '@/server/cms/posts/schema'
import { loadOwnedPostOr404, createPost, updatePostMeta } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: upsertPostMetaSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    const user = ctx.session.get('user')
    const sessionUserId = user?.id ? BigInt(user.id) : null
    // Ownership check: if updating an existing post, verify ownership.
    if (payload.id !== undefined) {
      await loadOwnedPostOr404(BigInt(payload.id), { role: ctx.role, userId: user?.id ?? '' })
    }
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
    const post =
      payload.id === undefined
        ? await createPost(meta, sessionUserId)
        : await updatePostMeta({ id: BigInt(payload.id), ...meta })
    return { post }
  },
})
