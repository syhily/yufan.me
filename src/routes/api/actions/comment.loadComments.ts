import config from '@/blog.config'
import { loadComments, parseComments } from '@/server/comments/loader'
import { loadCommentsSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

export const loader = defineApiAction({
  method: 'GET',
  input: loadCommentsSchema,
  async run({ ctx, payload }) {
    const comments = await loadComments(ctx.session, payload.page_key, null, payload.offset)
    if (comments === null) {
      throw new ActionFailure(500, '无法连接到评论服务器')
    }
    const items = await parseComments(comments.comments)
    const next = config.settings.comments.size + payload.offset < comments.roots_count
    return { comments: items, next }
  },
})
