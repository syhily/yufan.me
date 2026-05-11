import { createComment } from '@/server/comments/loader'
import { commentReplySchema } from '@/server/comments/schema'
import { tryCommentPostRateLimit, tryCommentPostRateLimitByEmail } from '@/server/rate-limit'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure, DomainError } from '@/server/route-helpers/errors'
import { clearCsrfCookie, issueCsrfToken, validateRequestCsrf } from '@/server/session'

// Accepts JSON only — PortableText bodies aren't form-encodable, so
// the public reply form posts JSON through `useApiFetcher` (the
// legacy `<fetcher.Form>` path was retired with the markdown
// pipeline).
export const action = defineApiAction({
  method: 'POST',
  input: commentReplySchema,
  inputSource: 'json',
  run: async ({ ctx, payload, isAdmin }) => {
    const [csrfOk] = await validateRequestCsrf(ctx.request, payload.csrf)
    if (!csrfOk) {
      throw new ActionFailure(403, '页面安全令牌已失效，请刷新后重试。', undefined, {
        'Set-Cookie': await clearCsrfCookie(),
      })
    }

    if (!isAdmin()) {
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
    return {
      data: { comment, csrfToken: rotated.token },
      headers: { 'Set-Cookie': rotated.setCookie },
    }
  },
})
