import type { SessionUser } from '@/server/auth/session-storage'

import { ActionFailure, ErrorMessages } from '@/server/route-helpers/errors'

export const ROLE_LEVELS = { visitor: 1, author: 2, admin: 3 } as const
export type Role = keyof typeof ROLE_LEVELS
export type RoleOrNull = Role | null

export function hasAtLeast(role: RoleOrNull | undefined, min: Role): boolean {
  if (!role) {
    return false
  }
  return ROLE_LEVELS[role] >= ROLE_LEVELS[min]
}

/**
 * Per-request viewer identity. Build sites that authenticate every
 * request put one of these in their RBAC checks instead of passing
 * `(userId, role)` pairs all over the place. Created by
 * `defineApiAction` once the `requireRole` gate has passed, so handlers
 * receive a non-nullable `viewer`.
 */
export interface ViewerContext {
  userId: string
  role: Role
}

/**
 * Single role guard used by route loaders/actions and by
 * `defineApiAction`. Throws `ActionFailure(403)` if the caller is not
 * at least `min`. Asserts user/role into the type system on success.
 */
export function requireRole(
  ctx: { user?: SessionUser; role?: RoleOrNull },
  min: Role,
): asserts ctx is { user: SessionUser; role: Role } {
  if (!hasAtLeast(ctx.role, min)) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

// ---------------------------------------------------------------------------
// Permission predicates
//
// Used by route handlers that need to authorise an action against a
// specific row (post, image, music, comment). `viewer` is the
// per-request identity, the second argument is the row being operated
// on. All predicates short-circuit on admin (`admin` may always edit).
// ---------------------------------------------------------------------------

export function canEditPost(viewer: ViewerContext, post: { authorId: bigint | null }): boolean {
  if (viewer.role === 'admin') {
    return true
  }
  return post.authorId !== null && post.authorId.toString() === viewer.userId
}

export function canEditImage(viewer: ViewerContext, img: { uploaderId: bigint | null }): boolean {
  if (viewer.role === 'admin') {
    return true
  }
  return img.uploaderId !== null && img.uploaderId.toString() === viewer.userId
}

export function canEditMusic(viewer: ViewerContext, m: { uploaderId: bigint | null }): boolean {
  if (viewer.role === 'admin') {
    return true
  }
  return m.uploaderId !== null && m.uploaderId.toString() === viewer.userId
}

export function canManageComment(viewer: ViewerContext, c: { userId: bigint }): boolean {
  if (viewer.role === 'admin') {
    return true
  }
  return c.userId.toString() === viewer.userId
}
