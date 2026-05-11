import { z } from 'zod'

import { parseComments } from '@/server/comments/loader'
import { cleanupExpiredTokens } from '@/server/comments/token'
import { findCommentsByIds } from '@/server/db/query/comment'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'

const myCommentsSchema = z.object({
  page_key: z.string(),
})

export const loader = defineApiAction({
  method: 'GET',
  input: myCommentsSchema,
  async run({ ctx, payload }) {
    const cookie = parseCommentTokensCookie(ctx.request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    const commentIds: bigint[] = []
    for (const entry of validEntries) {
      if (entry.payload.pageKey === payload.page_key) {
        commentIds.push(BigInt(entry.payload.commentId))
      }
    }

    const comments = await findCommentsByIds(commentIds)
    const items = await parseComments(comments)

    const expiresAt: Record<string, number> = {}
    for (const entry of validEntries) {
      expiresAt[entry.payload.commentId] = entry.expiresAt
    }

    const headers = new Headers()
    // Always refresh the cookie so expired tokens are stripped.
    headers.append('Set-Cookie', serializeCommentTokensCookie(cleaned))

    return { data: { comments: items, expiresAt }, headers }
  },
})
