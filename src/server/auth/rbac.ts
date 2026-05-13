import type { SessionUser } from '@/server/auth/session-storage'

import { ActionFailure, ErrorMessages } from '@/server/route-helpers/errors'
import { hasAtLeast, type Role, type RoleOrNull, ROLE_LEVELS } from '@/shared/roles'

// Server-only re-exports for files that already import the role
// primitives via `@/server/auth/rbac`. The isomorphic source of
// truth is `@/shared/roles` — server adds the throwing guards on top.
export { hasAtLeast, ROLE_LEVELS, type Role, type RoleOrNull }

/**
 * Per-request viewer identity. Built once by `defineGuardedApiAction`
 * after `requireRole` has succeeded, then passed verbatim to
 * permission predicates. Carrying viewer instead of `(userId, role)`
 * pairs makes adding fields (e.g. session id) a non-breaking change.
 */
export interface ViewerContext {
  userId: string
  role: Role
}

/**
 * Asserts `user is SessionUser` AND `user.role >= min`. Throws
 * `ActionFailure(403)` otherwise. Use this from `defineGuardedApiAction`
 * and `admin.uploadImage` — anywhere we have a raw `SessionUser | undefined`
 * and want the type system to pick up the narrowed shape on the
 * non-throw path.
 */
export function requireUserRole(user: SessionUser | undefined, min: Role): asserts user is SessionUser {
  if (!user || !hasAtLeast(user.role, min)) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

/**
 * Convenience façade for route loaders: asserts on a `{ user, role }`
 * wrapper so callers can pass `getRouteRequestContext(...)` straight
 * in. Internally delegates to `requireUserRole` so the throw site
 * stays single-source-of-truth.
 */
export function requireRole(
  ctx: { user?: SessionUser; role?: RoleOrNull },
  min: Role,
): asserts ctx is { user: SessionUser; role: Role } {
  requireUserRole(ctx.user, min)
}

// ---------------------------------------------------------------------------
// Permission predicates
//
// Two families:
//
//  - `is{Entity}Owner(viewer, row)`: strict ownership, no admin bypass.
//    Use these on the "own-routes" — endpoints whose semantics are
//    explicitly "act as the owner" (`comment.updateOwn`, etc.). An admin
//    using these would log misleading audit trails AND get stuck on
//    DB-level WHERE clauses that further require `requested_by = viewer`.
//
//  - `canEdit{Entity}(viewer, row)`: admin OR owner. Use these on admin
//    surfaces where an admin is legitimately allowed to act on someone
//    else's row (admin posts/images/music management screens).
//
// Keeping the two families separate avoids the "for-the-sake-of-DRY"
// trap of collapsing them into one — see RBAC-REVIEW §R1.
// ---------------------------------------------------------------------------

export function isPostOwner(viewer: ViewerContext, post: { authorId: bigint | null }): boolean {
  return post.authorId !== null && post.authorId.toString() === viewer.userId
}

export function isImageOwner(viewer: ViewerContext, img: { uploaderId: bigint | null }): boolean {
  return img.uploaderId !== null && img.uploaderId.toString() === viewer.userId
}

export function isMusicOwner(viewer: ViewerContext, m: { uploaderId: bigint | null }): boolean {
  return m.uploaderId !== null && m.uploaderId.toString() === viewer.userId
}

export function isCommentOwner(viewer: ViewerContext, c: { userId: bigint }): boolean {
  return c.userId.toString() === viewer.userId
}

export function canEditPost(viewer: ViewerContext, post: { authorId: bigint | null }): boolean {
  return viewer.role === 'admin' || isPostOwner(viewer, post)
}

export function canEditImage(viewer: ViewerContext, img: { uploaderId: bigint | null }): boolean {
  return viewer.role === 'admin' || isImageOwner(viewer, img)
}

export function canEditMusic(viewer: ViewerContext, m: { uploaderId: bigint | null }): boolean {
  return viewer.role === 'admin' || isMusicOwner(viewer, m)
}

export function canManageComment(viewer: ViewerContext, c: { userId: bigint }): boolean {
  return viewer.role === 'admin' || isCommentOwner(viewer, c)
}
