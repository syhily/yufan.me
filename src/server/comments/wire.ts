// Wire-projection helpers for comment payloads.
//
// Drizzle types `comment.id` / `userId` / `ownerId` / `rootId` as
// `bigint` (the `bigserial` columns flow through `mode: 'bigint'`)
// and timestamps as `Date`. Both fail `JSON.stringify` for bigints
// and emit Date as ISO strings only by virtue of `Date#toJSON`. The
// contract DTOs in `_dtos.ts` model the wire shape — `string` ids,
// ISO timestamps — which is what consumers expect over the network.
//
// These helpers do the projection explicitly so the response
// runtime check in `ts-rest-adapter` is satisfied. They are
// idempotent: pre-converted values (`id` already a string) pass
// straight through.
//
// A future server-side TS refactor will retype `CommentAndUser` to
// `CommentItemWire` directly and collapse these helpers into a
// single identity call.

import type { AdminComment, CommentAndUser, CommentItem } from '@/shared/comments'
import type { AdminCommentWire, CommentItemWire } from '@/shared/contracts/_dtos'

function asString(value: bigint | string | null | undefined): string {
  if (typeof value === 'string') {
    return value
  }
  return String(value ?? '')
}

function asNullableString(value: bigint | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return typeof value === 'string' ? value : String(value)
}

function asIso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) {
    // Empty ISO never happens on a valid comment row; the schema
    // requires a value. Falling back to "" lets the response
    // validator pinpoint the real null source rather than crashing
    // on `.toISOString()`.
    return ''
  }
  return typeof value === 'string' ? value : value.toISOString()
}

function asNullableIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return typeof value === 'string' ? value : value.toISOString()
}

function projectCommentBase(row: CommentAndUser): CommentItemWire {
  return {
    id: asString(row.id),
    createAt: asIso(row.createAt),
    updatedAt: asIso(row.updatedAt),
    deleteAt: asNullableIso(row.deleteAt),
    deleteRequestedAt: row.deleteRequestedAt === undefined ? undefined : asNullableIso(row.deleteRequestedAt),
    body: row.body,
    content: row.content,
    type: row.type,
    ownerId: asNullableString(row.ownerId),
    userId: asString(row.userId),
    isVerified: row.isVerified,
    ua: row.ua,
    ip: row.ip,
    rid: row.rid,
    isCollapsed: row.isCollapsed,
    isPending: row.isPending,
    isPinned: row.isPinned,
    voteUp: row.voteUp,
    voteDown: row.voteDown,
    rootId: asNullableString(row.rootId),
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    link: row.link,
    badgeName: row.badgeName,
    badgeColor: row.badgeColor,
    badgeTextColor: row.badgeTextColor,
  }
}

export function asCommentItemWire(comment: CommentItem | CommentAndUser): CommentItemWire {
  const base = projectCommentBase(comment)
  const children = (comment as CommentItem).children
  if (children !== undefined) {
    base.children = children.map((c) => asCommentItemWire(c))
  }
  return base
}

export function asCommentItemsWire(comments: CommentItem[]): CommentItemWire[] {
  return comments.map((c) => asCommentItemWire(c))
}

export function asAdminCommentsWire(comments: AdminComment[]): AdminCommentWire[] {
  return comments.map((row) => ({
    ...projectCommentBase(row),
    pageTitle: row.pageTitle,
    pagePublicId: row.pagePublicId,
  }))
}
