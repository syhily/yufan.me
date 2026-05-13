import type { AdminCommentsResult } from '@/server/comments/types'
import type { AdminListFilters, AdminPendingKind } from '@/server/db/query/comment'
import type { EntityTarget } from '@/server/db/target'
import type { AdminPendingDashboardDto, AdminPendingItemDto } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'

import { withCommentBadgeTextColor } from '@/server/comments/badge'
import { canonicalizeCommentBody } from '@/server/comments/canonicalize'
import {
  approveCommentById,
  countAdminPendingDashboard,
  countAllComments,
  deleteCommentById,
  findCommentWithUserAndTarget,
  findCommentWithUserById,
  listAdminComments,
  listAdminPendingDashboard,
  searchCommentAuthors,
  searchPages,
  updateCommentBodyAndContent,
  updateOwnCommentBody,
  updateOwnCommentBodyAndPending,
} from '@/server/db/query/comment'
import { findMetricByPublicId } from '@/server/db/query/metric'
import { sendApprovedComment, sendNewComment } from '@/server/email/sender'
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
  const c = await findCommentWithUserAndTarget(id)
  if (c && c.comment.type !== null && c.comment.ownerId !== null) {
    const target: EntityTarget = { type: c.comment.type as 'post' | 'page', ownerId: c.comment.ownerId }
    void sendApprovedComment(c.comment, c.user, target).catch((error) => {
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

// Owner self-edit path (`comment.updateOwn`). Distinct from
// `updateComment` so a moderator editing someone else's comment from
// `/wp-admin/comments` neither flips the row back into the moderation
// queue nor fires another admin-notification email.
//
// Edits within `OWN_EDIT_GRACE_MS` of the original `createdAt` are
// treated as fresh follow-up typing — the row stays in whatever
// moderation state it was already in (typically `approved`), only the
// body / content / updatedAt are rewritten, and no admin notification
// fires. Edits outside the grace window mirror design §9.3 steps 4-5:
// rewrite body + content, set `is_pending = true`, bump `updated_at`,
// then fire-and-forget `sendNewComment(admin, target)` so the
// moderation inbox sees the pending re-review.
const OWN_EDIT_GRACE_MS = 30 * 60 * 1000

export async function updateOwnComment(rid: string, newBody: CommentBody) {
  const id = BigInt(rid)
  const existing = await findCommentWithUserById(id)
  // Race: the comment may have vanished between the route's ownership
  // check and this call (admin hard-delete, soft-delete reaper, …).
  if (existing === null) {
    return null
  }
  const { body, content } = await canonicalizeCommentBody(newBody)
  const insideGrace = Date.now() - existing.createAt.getTime() < OWN_EDIT_GRACE_MS
  if (insideGrace) {
    await updateOwnCommentBody(id, body, content)
  } else {
    await updateOwnCommentBodyAndPending(id, body, content)
  }

  const r = await findCommentWithUserById(id)
  if (r === null) {
    return null
  }

  // Only the re-pend path notifies the admin — inside-grace edits stay
  // silent so a commenter polishing their just-posted reply doesn't
  // spam the moderation inbox.
  if (!insideGrace) {
    if (r.type !== null && r.ownerId !== null) {
      const target: EntityTarget = { type: r.type, ownerId: r.ownerId }
      void sendNewComment(r, target).catch((error) => {
        log.error('failed to send new comment email (own edit)', { error })
      })
    } else {
      log.warn('skipping new-comment email after own edit: missing target', { commentId: id })
    }
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
  publicIds?: string[],
): Promise<Array<{ key: string; title: string }>> {
  return searchPages(q, limit, publicIds)
}

export async function searchAuthorOptions(
  q: string | undefined,
  limit: number,
  ids?: bigint[],
): Promise<Array<{ id: bigint; name: string }>> {
  return searchCommentAuthors(q, limit, ids)
}

// Welcome-dashboard moderation inbox. Same row shape across both queues
// (approval / deletion) so the UI renders a single table — the
// `kind` discriminator switches the action buttons. `excerpt` is a
// 120-codepoint slice of the markdown snapshot (mirrors `wp-admin/my/comments`
// at a slightly larger cap so admins reading the dashboard get enough
// context without expanding the row).
const DASHBOARD_EXCERPT_LIMIT = 120

function makeDashboardExcerpt(raw: string | null): string {
  if (!raw) {
    return ''
  }
  const trimmed = raw.trim()
  if (trimmed === '') {
    return ''
  }
  const codepoints = Array.from(trimmed)
  if (codepoints.length <= DASHBOARD_EXCERPT_LIMIT) {
    return trimmed
  }
  return `${codepoints.slice(0, DASHBOARD_EXCERPT_LIMIT).join('')}…`
}

function entityPermalink(type: 'post' | 'page', slug: string): string {
  return type === 'post' ? `/posts/${slug}` : `/${slug}`
}

export async function loadAdminPendingDashboard(
  kind: AdminPendingKind,
  offset: number,
  limit: number,
): Promise<AdminPendingDashboardDto> {
  const [rows, counts] = await Promise.all([
    listAdminPendingDashboard(kind, offset, limit),
    countAdminPendingDashboard(),
  ])
  const items: AdminPendingItemDto[] = rows.map((row) => ({
    id: String(row.id),
    // Deletion dominates the union — if both flags are live, surface the
    // row as a deletion request so the admin sees the more urgent state.
    kind: row.deleteRequestedAt !== null ? 'deletion' : 'approval',
    authorName: row.authorName,
    authorLink: row.authorLink,
    excerpt: makeDashboardExcerpt(row.content),
    createdAtIso: row.createdAt.toISOString(),
    deleteRequestedAtIso: row.deleteRequestedAt ? row.deleteRequestedAt.toISOString() : null,
    pageTitle: row.pageTitle,
    pagePermalink: row.pageSlug && row.type ? entityPermalink(row.type, row.pageSlug) : null,
  }))
  const total = kind === 'approval' ? counts.approval : kind === 'deletion' ? counts.deletion : counts.all
  return {
    items,
    total,
    hasMore: offset + items.length < total,
    counts,
  }
}

export async function loadAllComments(
  offset: number,
  limit: number,
  filterPublicId?: string,
  filterUserId?: bigint,
  status?: 'all' | 'pending' | 'approved',
): Promise<AdminCommentsResult> {
  // Resolve the wire `pageKey` (UUID) into a (type, owner_id) target
  // once up front so the four list / count queries below can each
  // filter on the indexed columns directly.
  let target: EntityTarget | undefined
  if (filterPublicId) {
    const metricRow = await findMetricByPublicId(filterPublicId)
    if (metricRow !== null && metricRow.type !== null && metricRow.ownerId !== null) {
      target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    } else {
      // Caller filtered on an unknown UUID — there can be no matches.
      return {
        comments: [],
        total: 0,
        hasMore: false,
        statusCounts: { all: 0, pending: 0, approved: 0 },
      }
    }
  }
  const baseFilters = { target, userId: filterUserId } satisfies AdminListFilters
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
      pagePublicId: c.pagePublicId,
    })),
    total,
    hasMore: offset + limit < total,
    statusCounts: { all: allCount, pending: pendingCount, approved: approvedCount },
  }
}
