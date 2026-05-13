import { updateComment } from '@/server/comments/admin'
import { commentEditSchema } from '@/server/comments/schema'
import { verifyCommentOwnership } from '@/server/comments/token'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { userSession } from '@/server/session'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

export const action = defineApiAction({
  method: 'PATCH',
  input: commentEditSchema,
  async run({ ctx, payload }) {
    const admin = userSession(ctx.session)?.role === 'admin'
    const headers = new Headers()

    if (!admin) {
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
      const { ok, cleaned } = await verifyCommentOwnership(cookie, payload.rid)
      if (!ok) {
        throw new ActionFailure(403, '无权编辑该评论')
      }
      headers.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
    }

    const updated = await updateComment(payload.rid, payload.body)
    if (!updated) {
      throw new ActionFailure(500, '更新评论失败')
    }

    if (headers.has('Set-Cookie')) {
      return { data: { comment: updated }, headers }
    }
    return { comment: updated }
  },
})
