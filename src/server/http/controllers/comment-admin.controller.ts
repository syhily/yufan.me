import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import {
  approveComment,
  deleteComment,
  loadAllComments,
  searchAuthorOptions,
  searchPageOptions,
} from '@/server/comments/admin'
import { commentAdminContract } from '@/shared/contracts/comment-admin'

export const commentAdminController: AuthedContractImpl<typeof commentAdminContract> = {
  approve: async ({ params }) => {
    await approveComment(params.rid)
    return { status: 200 as const, body: null }
  },

  delete: async ({ params }) => {
    await deleteComment(params.rid)
    return { status: 200 as const, body: null }
  },

  loadAll: async ({ body }) => {
    const result = await loadAllComments(
      body.offset,
      body.limit,
      body.pageKey,
      body.userId ? BigInt(body.userId) : undefined,
      body.status,
    )
    return {
      status: 200 as const,
      body: {
        comments: result.comments,
        total: result.total,
        hasMore: result.hasMore,
        statusCounts: result.statusCounts,
      },
    }
  },

  searchPages: async ({ query }) => {
    const keys = query.key ? [query.key] : undefined
    const pages = await searchPageOptions(query.q, query.limit, keys)
    return { status: 200 as const, body: { pages } }
  },

  searchAuthors: async ({ query }) => {
    function parseBigIntIds(raw: string | undefined): bigint[] | undefined {
      if (!raw || raw.length === 0) {
        return undefined
      }
      const out: bigint[] = []
      for (const value of raw.split(',')) {
        const trimmed = value.trim()
        if (!trimmed) {
          continue
        }
        try {
          out.push(BigInt(trimmed))
        } catch {
          /* drop */
        }
      }
      return out.length > 0 ? out : undefined
    }

    const ids = parseBigIntIds(query.ids)
    const authors = await searchAuthorOptions(query.q, query.limit, ids)
    return {
      status: 200 as const,
      body: {
        authors: authors.map((author) => ({ id: String(author.id), name: author.name })),
      },
    }
  },
}
