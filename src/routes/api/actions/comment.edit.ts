import { updateComment } from '@/server/comments/admin'
import { commentEditSchema } from '@/server/comments/schema'
import { verifyCommentOwnership } from '@/server/comments/token'
import { findCommentWithUserById } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { userSession } from '@/server/session'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

// Three legitimate paths to edit a comment:
//   1. Admin session     → bypass token check.
//   2. Owner session     → logged-in user editing their own row;
//                          no anonymous-token cookie required.
//   3. Anonymous token   → cookie-bound proof of authorship issued
//                          when an anonymous visitor first posted.
//
// Path (2) is what makes self-service edit work for visitors who
// signed in through `/wp-login.php` without ever having held an
// anonymous token (e.g. they got upgraded to a real account via
// password reset). See RBAC-REVIEW §F10.
export const action = defineApiAction({
  method: 'PATCH',
  input: commentEditSchema,
  async run({ ctx, payload }) {
    const sessionUser = userSession(ctx.session)
    const isAdmin = sessionUser?.role === 'admin'
    const headers = new Headers()

    if (!isAdmin) {
      // Probe ownership of the row before falling through to the
      // anonymous-token path. Skipping the token round-trip when the
      // logged-in user is the author keeps cookie-less edits working.
      const commentId = BigInt(payload.rid)
      const row = await findCommentWithUserById(commentId)
      const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id

      if (!ownerBySession) {
        const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
        const { ok, cleaned } = await verifyCommentOwnership(cookie, payload.rid)
        if (!ok) {
          throw new ActionFailure(403, '无权编辑该评论')
        }
        headers.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
      }
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
