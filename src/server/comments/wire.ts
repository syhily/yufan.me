// Wire-projection helpers for comment payloads.
//
// Drizzle types `comment.id` (and friends) as `bigint` because the column
// is `bigserial`, but the node-postgres driver actually returns int8 values
// as JS `string` (Number can't safely hold the full int64 range). So at
// runtime, every "bigint" comment field is already a string — only the
// TS type is lying.
//
// The new `commentItemDto` / `adminCommentDto` contract DTOs tell the
// runtime truth: ids are `string`, timestamps are ISO strings. To bridge
// the legacy TS shape (`CommentAndUser` / `CommentItem` / `AdminComment`)
// to the contract without re-typing every consumer in one PR, the
// controller layer routes server-shaped values through the helpers
// below. They are pure casts — the runtime payload is already correct.
//
// A follow-up PR will retype `src/shared/comments.ts` to match the wire
// shape, at which point these helpers collapse to identity functions
// and can be inlined or deleted.

import type { AdminComment, CommentAndUser, CommentItem } from '@/shared/comments'
import type { AdminCommentWire, CommentItemWire } from '@/shared/contracts/_dtos'

export function asCommentItemsWire(comments: CommentItem[]): CommentItemWire[] {
  return comments as unknown as CommentItemWire[]
}

export function asCommentItemWire(comment: CommentItem | CommentAndUser): CommentItemWire {
  return comment as unknown as CommentItemWire
}

export function asAdminCommentsWire(comments: AdminComment[]): AdminCommentWire[] {
  return comments as unknown as AdminCommentWire[]
}
