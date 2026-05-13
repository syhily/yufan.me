import type { SessionContext } from '@/server/auth/primitives'

import { ActionFailure, ErrorMessages } from '@/server/route-helpers/errors'

export const ROLE_LEVELS = { visitor: 1, author: 2, admin: 3 } as const
export type Role = keyof typeof ROLE_LEVELS

export function hasAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (role === null || role === undefined) {
    return false
  }
  return ROLE_LEVELS[role] >= ROLE_LEVELS[min]
}

export interface AuthedContext extends SessionContext {
  user: NonNullable<SessionContext['user']>
  role: Role
}

export interface AdminContext extends AuthedContext {
  role: 'admin'
}

export interface AuthorContext extends AuthedContext {
  role: 'admin' | 'author'
}

export function requireRole(ctx: SessionContext, min: Role): asserts ctx is AuthedContext {
  if (!hasAtLeast(ctx.role, min)) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

export function requireAdmin(ctx: SessionContext): asserts ctx is AdminContext {
  if (!hasAtLeast(ctx.role, 'admin')) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

export function requireAuthor(ctx: SessionContext): asserts ctx is AuthorContext {
  if (!hasAtLeast(ctx.role, 'author')) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

export function canEditPost(ctx: AuthedContext, post: { authorId: bigint | null }): boolean {
  if (ctx.role === 'admin') {
    return true
  }
  return post.authorId !== null && post.authorId.toString() === ctx.user.id
}

export function canEditImage(ctx: AuthedContext, img: { uploaderId: bigint | null }): boolean {
  if (ctx.role === 'admin') {
    return true
  }
  return img.uploaderId !== null && img.uploaderId.toString() === ctx.user.id
}

export function canEditMusic(ctx: AuthedContext, m: { uploaderId: bigint | null }): boolean {
  if (ctx.role === 'admin') {
    return true
  }
  return m.uploaderId !== null && m.uploaderId.toString() === ctx.user.id
}

export function canDeleteTag(ctx: AuthedContext, postCount: number): boolean {
  if (ctx.role === 'admin') {
    return true
  }
  return postCount === 0
}

export function canManageComment(ctx: AuthedContext, c: { userId: bigint }): boolean {
  if (ctx.role === 'admin') {
    return true
  }
  return c.userId.toString() === ctx.user.id
}
