import { commentRidSchema } from '@/server/comments/schema'
import { cleanupExpiredTokens, revokeCommentToken } from '@/server/comments/token'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

export const action = defineApiAction({
  method: 'POST',
  input: commentRidSchema,
  async run({ ctx, payload }) {
    const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    let targetToken: string | null = null
    for (const entry of validEntries) {
      if (entry.payload.commentId === payload.rid) {
        targetToken = entry.token
        break
      }
    }

    if (targetToken) {
      await revokeCommentToken(targetToken)
    }

    const next: typeof cleaned = {}
    for (const [pageKey, entries] of Object.entries(cleaned)) {
      const filtered = entries.filter((e) => e.token !== targetToken)
      if (filtered.length > 0) {
        next[pageKey] = filtered
      }
    }

    const headers = new Headers()
    headers.append('Set-Cookie', serializeCommentTokensCookie(next))

    return { data: { success: true }, headers }
  },
})
