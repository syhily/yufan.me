import type { AdminComment, AdminCommentsResult } from '@/server/comments/types'
import type { AdminListFilters } from '@/server/db/query/comment'

import { withCommentBadgeTextColor } from '@/server/comments/badge'
import {
  approveCommentById,
  countAllComments,
  deleteCommentById,
  findCommentWithUserAndPage,
  findCommentWithUserById,
  listAdminComments,
  listAllPages,
  listCommentAuthors,
  updateCommentContent,
} from '@/server/db/query/comment'
import { sendApprovedComment } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { compileMarkdown } from '@/server/markdown/runtime'

// Admin-only helpers for the moderation panel. Split out of `loader.server.ts`
// so the public detail-route bundle no longer drags in the admin-list query
// helpers transitively (page loaders only need the public surface). All
// callers are gated by the routing-layer `adminMiddleware`, so these helpers
// themselves do not re-check authorization.
const log = getLogger('comments.admin')

export async function approveComment(rid: string) {
  const id = BigInt(rid)
  await approveCommentById(id)
  const c = await findCommentWithUserAndPage(id)
  if (c) {
    void sendApprovedComment(c.comment, c.user, c.page).catch((error) => {
      log.error('failed to send approved comment email', { error })
    })
  }
}

export async function deleteComment(rid: string) {
  await deleteCommentById(BigInt(rid))
}

export async function getCommentById(rid: string) {
  return findCommentWithUserById(BigInt(rid))
}

export async function updateComment(rid: string, newContent: string) {
  const id = BigInt(rid)
  await updateCommentContent(id, newContent)

  const r = await findCommentWithUserById(id)
  if (r === null) {
    return null
  }

  // Keep `r.content` as raw markdown (matches the public-facing
  // `createComment` shape) and attach the compiled body for the React
  // surface. The admin edit form re-loads the raw source through
  // `comment.getRaw` so callers never read `content` for rendering.
  const compiled = await compileMarkdown(r.content, { profile: 'comment' })
  return {
    ...withCommentBadgeTextColor(r),
    bodyCompiled: compiled?.compiled ?? null,
  }
}

export async function getPageOptions(): Promise<Array<{ key: string; title: string }>> {
  return listAllPages()
}

export async function getCommentAuthors(): Promise<Array<{ id: bigint; name: string }>> {
  return listCommentAuthors()
}

export async function loadAllComments(
  offset: number,
  limit: number,
  filterPageKey?: string,
  filterUserId?: bigint,
  status?: 'all' | 'pending' | 'approved',
): Promise<AdminCommentsResult> {
  const filters: AdminListFilters = {
    pageKey: filterPageKey,
    userId: filterUserId,
    status,
  }
  // Count and list are independent queries — fetch them concurrently.
  const [total, comments] = await Promise.all([countAllComments(filters), listAdminComments(offset, limit, filters)])

  return {
    comments: await Promise.all(
      comments.map(async (c): Promise<AdminComment> => {
        const compiled = await compileMarkdown(c.content, { profile: 'comment' })
        return {
          ...withCommentBadgeTextColor(c),
          bodyCompiled: compiled?.compiled ?? null,
          pageTitle: c.pageTitle,
        }
      }),
    ),
    total,
    hasMore: offset + limit < total,
  }
}
