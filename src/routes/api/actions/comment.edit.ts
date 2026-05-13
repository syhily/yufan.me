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
//   2. Anonymous token   → cookie-bound proof of authorship issued
//                          when an anonymous visitor first posted.
//                          Checked FIRST (in-memory hash, no DB) so
//                          the common public-reply edit doesn't pay
//                          a DB read.
//   3. Owner session     → logged-in user editing their own row;
//                          requires a DB probe to find the row's
//                          author. Used as a fallback when no
//                          anonymous token matches.
//
// Path (3) is what makes self-service edit work for visitors who
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
      // 1) Anonymous-token path FIRST — pure in-memory hash check.
      //    `ok=false` from verifyCommentOwnership does NOT mean
      //    "reject"; it means "no valid token, try next path".
      const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
      const { ok: ownerByToken, cleaned } = await verifyCommentOwnership(cookie, payload.rid)

      if (ownerByToken) {
        headers.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
      } else {
        // 2) Fall back to a DB probe: is the logged-in session the
        //    author of the row?
        const commentId = BigInt(payload.rid)
        const row = await findCommentWithUserById(commentId)
        const ownerBySession = sessionUser !== undefined && row !== null && row.userId.toString() === sessionUser.id

        if (!ownerBySession) {
          throw new ActionFailure(403, '无权编辑该评论')
        }
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
