import { z } from 'zod'

import { parseComments } from '@/server/comments/loader'
import { cleanupExpiredTokens, revokeCommentToken } from '@/server/comments/token'
import { asCommentItemsWire } from '@/server/comments/wire'
import { findCommentsByIds } from '@/server/db/query/comment'
import { publicProc } from '@/server/http/orpc-base'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'
import { commentItemDto } from '@/shared/contracts/_dtos'

const revokeToken = publicProc
  .input(z.object({ rid: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const cookie = parseCommentTokensCookie(context.request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)
    let targetToken: string | null = null
    for (const entry of validEntries) {
      if (entry.payload.commentId === input.rid) {
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
    context.responseHeaders.append('Set-Cookie', serializeCommentTokensCookie(next))
    return { success: true }
  })

const myComments = publicProc
  .input(z.object({ page_key: z.string() }))
  .output(z.object({ comments: z.array(commentItemDto), expiresAt: z.record(z.string(), z.number()) }))
  .handler(async ({ input, context }) => {
    const cookie = parseCommentTokensCookie(context.request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)
    const commentIds: bigint[] = []
    for (const entry of validEntries) {
      if (entry.payload.pageKey === input.page_key) {
        commentIds.push(BigInt(entry.payload.commentId))
      }
    }
    const comments = await findCommentsByIds(commentIds)
    const items = await parseComments(comments)
    const expiresAt: Record<string, number> = {}
    for (const entry of validEntries) {
      expiresAt[entry.payload.commentId] = entry.expiresAt
    }
    context.responseHeaders.append('Set-Cookie', serializeCommentTokensCookie(cleaned))
    return { comments: asCommentItemsWire(items), expiresAt }
  })

export const commentTokenRouter = {
  revokeToken,
  myComments,
}
