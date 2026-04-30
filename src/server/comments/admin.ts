import type { AdminCommentsResult } from '@/server/comments/types'
import type { AdminListFilters } from '@/server/db/query/comment'

import { withCommentBadgeTextColor } from '@/server/comments/badge'
import {
  approveCommentById,
  countAllComments,
  deleteCommentById,
  findCommentWithUserAndPage,
  findCommentWithUserById,
  listAdminComments,
  searchCommentAuthors,
  searchPages,
  updateCommentContent,
} from '@/server/db/query/comment'
import { sendApprovedComment } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { parseContent } from '@/server/markdown/parser'

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
  if (r === null) return null

  r.content = await parseContent(r.content)
  return withCommentBadgeTextColor(r)
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
  const filters: AdminListFilters = {
    pageKey: filterPageKey,
    userId: filterUserId,
    status,
  }
  // Count and list are independent queries — fetch them concurrently.
  const [total, comments] = await Promise.all([countAllComments(filters), listAdminComments(offset, limit, filters)])

  return {
    comments: await Promise.all(
      comments.map(async (c) => ({
        ...withCommentBadgeTextColor(c),
        content: await parseContent(c.content),
        pageTitle: c.pageTitle,
      })),
    ),
    total,
    hasMore: offset + limit < total,
  }
}
