import type { PublicContractImpl } from '@/server/http/ts-rest-adapter'

import { parseComments } from '@/server/comments/loader'
import { cleanupExpiredTokens, revokeCommentToken } from '@/server/comments/token'
import { findCommentsByIds } from '@/server/db/query/comment'
import { parseCommentTokensCookie, serializeCommentTokensCookie } from '@/shared/comment-token'
import { commentTokenContract } from '@/shared/contracts/comment-token'

export const commentTokenController: PublicContractImpl<typeof commentTokenContract> = {
  revokeToken: async ({ body }, { request }) => {
    const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    let targetToken: string | null = null
    for (const entry of validEntries) {
      if (entry.payload.commentId === body.rid) {
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

    return {
      status: 200 as const,
      body: { success: true },
      headers: { 'Set-Cookie': [serializeCommentTokensCookie(next)] },
    }
  },

  myComments: async ({ query }, { request }) => {
    const cookie = parseCommentTokensCookie(request.headers.get('Cookie'))
    const { cleaned, validEntries } = await cleanupExpiredTokens(cookie)

    const commentIds: bigint[] = []
    for (const entry of validEntries) {
      if (entry.payload.pageKey === query.page_key) {
        commentIds.push(BigInt(entry.payload.commentId))
      }
    }

    const comments = await findCommentsByIds(commentIds)
    const items = await parseComments(comments)

    const expiresAt: Record<string, number> = {}
    for (const entry of validEntries) {
      expiresAt[entry.payload.commentId] = entry.expiresAt
    }

    return {
      status: 200 as const,
      body: { comments: items, expiresAt },
      headers: { 'Set-Cookie': [serializeCommentTokensCookie(cleaned)] },
    }
  },
}
