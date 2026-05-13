import type { BlogSession } from '@/server/auth/session-storage'

import { ActionFailure, ErrorMessages } from '@/server/route-helpers/errors'

export const ROLE_LEVELS = { visitor: 1, author: 2, admin: 3 } as const
export type Role = keyof typeof ROLE_LEVELS
export type RoleOrNull = Role | null

export function hasAtLeast(role: RoleOrNull | undefined, min: Role): boolean {
  if (!role) return false
  return ROLE_LEVELS[role] >= ROLE_LEVELS[min]
}

export interface AuthedSessionContext {
  session: BlogSession
  user: NonNullable<ReturnType<typeof import('@/server/auth/primitives').userSession>>
  role: Role
}

export interface AdminSessionContext extends AuthedSessionContext {
  role: 'admin'
}

export function requireRole(
  ctx: {
    user?: { id: string; name: string; email: string; website: string | null; role?: Role | null }
    role?: RoleOrNull
  },
  min: Role,
): asserts ctx is { user: NonNullable<typeof ctx.user>; role: Role } {
  if (!hasAtLeast(ctx.role, min)) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}

export function requireAdmin(ctx: {
  user?: { id: string; name: string; email: string; website: string | null; role?: Role | null }
  role?: RoleOrNull
}): asserts ctx is { user: NonNullable<typeof ctx.user>; role: 'admin' } {
  requireRole(ctx, 'admin')
}

export function requireAuthor(ctx: {
  user?: { id: string; name: string; email: string; website: string | null; role?: Role | null }
  role?: RoleOrNull
}): asserts ctx is { user: NonNullable<typeof ctx.user>; role: Role } {
  requireRole(ctx, 'author')
}

export function canEditPost(ctx: AuthedSessionContext, post: { authorId: bigint | null }): boolean {
  if (ctx.role === 'admin') return true
  return post.authorId !== null && post.authorId.toString() === ctx.user.id
}

export function canEditImage(ctx: AuthedSessionContext, img: { uploaderId: bigint | null }): boolean {
  if (ctx.role === 'admin') return true
  return img.uploaderId !== null && img.uploaderId.toString() === ctx.user.id
}

export function canEditMusic(ctx: AuthedSessionContext, m: { uploaderId: bigint | null }): boolean {
  if (ctx.role === 'admin') return true
  return m.uploaderId !== null && m.uploaderId.toString() === ctx.user.id
}

export function canDeleteTag(ctx: AuthedSessionContext, _tag: unknown, postCount: number): boolean {
  if (ctx.role === 'admin') return true
  return postCount === 0
}

export function canManageComment(ctx: AuthedSessionContext, c: { userId: bigint }): boolean {
  if (ctx.role === 'admin') return true
  return c.userId.toString() === ctx.user.id
}
