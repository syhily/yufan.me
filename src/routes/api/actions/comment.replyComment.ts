import { createComment } from '@/server/comments/loader'
import { commentReplySchema } from '@/server/comments/schema'
import { appendCommentToken, issueCommentToken } from '@/server/comments/token'
import { tryCommentPostRateLimit, tryCommentPostRateLimitByEmail } from '@/server/rate-limit'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure, DomainError } from '@/server/route-helpers/errors'
import { clearCsrfCookie, issueCsrfToken, userSession, validateRequestCsrf } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

// Accepts JSON only — PortableText bodies aren't form-encodable, so
// the public reply form posts JSON through `useApiFetcher` (the
// legacy `<fetcher.Form>` path was retired with the markdown
// pipeline).
export const action = defineApiAction({
  method: 'POST',
  input: commentReplySchema,
  inputSource: 'json',
  run: async ({ ctx, payload }) => {
    const [csrfOk] = await validateRequestCsrf(ctx.request, payload.csrf)
    if (!csrfOk) {
      throw new ActionFailure(403, '页面安全令牌已失效，请刷新后重试。', undefined, {
        'Set-Cookie': await clearCsrfCookie(),
      })
    }

    const isAdmin = userSession(ctx.session)?.role === 'admin'

    if (!isAdmin) {
      const byIp = await tryCommentPostRateLimit(ctx.clientAddress)
      if (byIp.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
      const byEmail = await tryCommentPostRateLimitByEmail(payload.email)
      if (byEmail.exceeded) {
        throw new DomainError('RATE_LIMITED')
      }
    }

    const { subtitle: _subtitle, csrf: _csrf, ...commentPayload } = payload
    void _subtitle
    void _csrf

    const comment = await createComment(commentPayload, ctx.request, ctx.clientAddress, ctx.session)
    const rotated = await issueCsrfToken()

    const headers = new Headers()
    headers.append('Set-Cookie', rotated.setCookie)

    // Issue a time-limited edit token for anonymous commenters.
    if (!isAdmin) {
      const ttl = requireBlogSettingsSection('comments').comments.tokenTtlSeconds
      const token = await issueCommentToken(comment.id, comment.userId, payload.page_key, ttl)
      const existing = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
      const next = appendCommentToken(existing, payload.page_key, token, ttl)
      headers.append('Set-Cookie', serializeCommentTokensCookie(next))
    }

    return {
      data: { comment, csrfToken: rotated.token },
      headers,
    }
  },
})
