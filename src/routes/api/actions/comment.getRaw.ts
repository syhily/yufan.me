import { getCommentById } from '@/server/comments/admin'
import { commentRidSchema } from '@/server/comments/schema'
import { verifyCommentOwnership } from '@/server/comments/token'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { userSession } from '@/server/session'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

export const loader = defineApiAction({
  method: 'GET',
  input: commentRidSchema,
  async run({ ctx, payload }) {
    const admin = userSession(ctx.session)?.role === 'admin'
    const headers = new Headers()

    if (!admin) {
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
      const { ok, cleaned } = await verifyCommentOwnership(cookie, payload.rid)
      if (!ok) {
        throw new ActionFailure(403, '无权查看该评论')
      }
      headers.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
    }

    const comment = await getCommentById(payload.rid)
    if (!comment) {
      throw new ActionFailure(404, '评论不存在')
    }

    if (headers.has('Set-Cookie')) {
      return { data: { body: comment.body }, headers }
    }
    return { body: comment.body }
  },
})
