import type { AdminCommentsResult } from '@/server/comments/types'
import type { AdminListFilters } from '@/server/db/query/comment'
import type { CommentBody } from '@/shared/pt/comment-schema'

import { withCommentBadgeTextColor } from '@/server/comments/badge'
import { canonicalizeCommentBody } from '@/server/comments/canonicalize'
import {
  approveCommentById,
  countAllComments,
  deleteCommentById,
  findCommentWithUserAndPage,
  findCommentWithUserById,
  listAdminComments,
  searchCommentAuthors,
  searchPages,
  updateCommentBodyAndContent,
} from '@/server/db/query/comment'
import { sendApprovedComment } from '@/server/email/sender'
import { getLogger } from '@/server/logger'

// Admin-only helpers for the moderation panel. Split out of `loader.server.ts`
// so the public detail-route bundle no longer drags in the admin-list query
// helpers transitively (page loaders only need the public surface). All
// callers are gated by `requireAdmin` in their action route, so these
// helpers themselves do not re-check authorization.
const log = getLogger('comments.admin')

export async function approveComment(rid: string) {
  const id = BigInt(rid)
  await approveCommentById(id)
  const c = await findCommentWithUserAndPage(id)
  if (c) {
    void sendApprovedComment(c.comment, c.user, c.metric).catch((error) => {
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

export async function updateComment(rid: string, newBody: CommentBody) {
  const id = BigInt(rid)
  const { body, content } = await canonicalizeCommentBody(newBody)
  await updateCommentBodyAndContent(id, body, content)

  const r = await findCommentWithUserById(id)
  if (r === null) {
    return null
  }

  return { ...withCommentBadgeTextColor(r), content: null }
}

// Server-side autocomplete: invoked by the moderation Combobox filters
// on every (debounced) keystroke. `q` is the current input value and
// `limit` caps the response so a misclick on a 50k-page site doesn't
// shovel everything to the client. The Comments view shows ~20 rows in
// its dropdown, so 20 is the natural default both here and on the
// schema layer.
export async function searchPageOptions(
  q: string | undefined,
  limit: number,
  keys?: string[],
): Promise<Array<{ key: string; title: string }>> {
  return searchPages(q, limit, keys)
}

export async function searchAuthorOptions(
  q: string | undefined,
  limit: number,
  ids?: bigint[],
): Promise<Array<{ id: bigint; name: string }>> {
  return searchCommentAuthors(q, limit, ids)
}

export async function loadAllComments(
  offset: number,
  limit: number,
  filterPageKey?: string,
  filterUserId?: bigint,
  status?: 'all' | 'pending' | 'approved',
): Promise<AdminCommentsResult> {
  const baseFilters = { pageKey: filterPageKey, userId: filterUserId } satisfies AdminListFilters
  const filters: AdminListFilters = { ...baseFilters, status }
  // List + 3 count queries are all independent — issue them concurrently.
  // We fetch counts for every status under the SAME page/user context so
  // the segmented control's three tabs can each show their own number
  // (`全部 · 8746` / `待审核 · 12` / `已审核 · 8734`) without an extra
  // round-trip per tab click.
  const [comments, allCount, pendingCount, approvedCount] = await Promise.all([
    listAdminComments(offset, limit, filters),
    countAllComments({ ...baseFilters, status: 'all' }),
    countAllComments({ ...baseFilters, status: 'pending' }),
    countAllComments({ ...baseFilters, status: 'approved' }),
  ])
  const total = status === 'pending' ? pendingCount : status === 'approved' ? approvedCount : allCount

  return {
    comments: comments.map((c) => ({
      ...withCommentBadgeTextColor(c),
      // Strip the server-only markdown snapshot from the admin DTO so
      // the moderation UI renders directly from the canonical `body`.
      content: null,
      pageTitle: c.pageTitle,
    })),
    total,
    hasMore: offset + limit < total,
    statusCounts: { all: allCount, pending: pendingCount, approved: approvedCount },
  }
}
