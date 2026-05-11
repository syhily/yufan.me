import { loadComments, parseComments } from '@/server/comments/loader'
import { loadCommentsSchema } from '@/server/comments/schema'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { requireBlogSettingsSection } from '@/shared/blog-config'

export const loader = defineApiAction({
  method: 'GET',
  input: loadCommentsSchema,
  async run({ ctx, payload }) {
    // Wire `page_key` is the metric's `public_id` UUID — resolve it
    // back to a `(type, owner_id)` target before fanning out to the
    // comment store.
    const metricRow = await findMetricByPublicId(payload.page_key)
    if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
      throw new ActionFailure(404, '评论目标不存在')
    }
    const target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    const comments = await loadComments(ctx.session, target, payload.offset)
    if (comments === null) {
      throw new ActionFailure(500, '无法连接到评论服务器')
    }
    const items = await parseComments(comments.comments)
    const next = requireBlogSettingsSection('comments').comments.size + payload.offset < comments.roots_count
    return { comments: items, next }
  },
})
