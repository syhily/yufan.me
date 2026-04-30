import bcrypt from 'bcryptjs'
import { and, count, desc, eq, isNull, max, or, sql } from 'drizzle-orm'

import type { NewUser, User } from '@/server/db/types'

import config from '@/blog.config'
import { db } from '@/server/db/pool'
import { comment, user } from '@/server/db/schema'

const PASSWORD_HASH_ROUNDS = 12

export async function hasAdmin(): Promise<boolean> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.isAdmin, true))
  return res.length > 0 && res[0].count > 0
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ?? null
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const u = await findUserByEmail(email)
  if (u === null) return null
  return (await bcrypt.compare(password, u.password)) ? u : null
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ? `${rows[0].id}` : null
}

export async function findEmailById(id: bigint): Promise<string | null> {
  const rows = await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1)
  return rows[0]?.email ?? null
}

export async function insertAdmin(name: string, email: string, password: string): Promise<User[]> {
  const hashedPassword = bcrypt.hashSync(password, PASSWORD_HASH_ROUNDS)
  const admin: NewUser = {
    name,
    email,
    emailVerified: false,
    link: config.website || '',
    isAdmin: true,
    password: hashedPassword,
    badgeName: 'MOD',
    badgeColor: '#008c95',
    receiveEmail: true,
  }
  return db.insert(user).values(admin).returning()
}

export async function insertCommentUser(name: string, email: string, website: string): Promise<User | null> {
  const existing = await findUserByEmail(email)
  if (existing !== null) return existing
  const u: NewUser = {
    name,
    email,
    emailVerified: false,
    link: website,
    isAdmin: false,
    password: '',
    badgeName: '',
    badgeColor: '',
    receiveEmail: true,
  }
  const res = await db.insert(user).values(u).returning()
  return res[0] ?? null
}

export async function updateLastLogin(id: bigint, ip: string, userAgent: string | null): Promise<void> {
  await db.update(user).set({ lastIp: ip, lastUa: userAgent }).where(eq(user.id, id))
}

export interface UserUpdate {
  name?: string
  email?: string
  link?: string
  badgeName?: string
  badgeColor?: string
  // `null` clears the manual override and reactivates the auto-derived
  // contrast pick (see `commentBadgeTextColor`); a non-null hex string
  // pins the badge text colour verbatim. Distinct from `undefined`
  // (which means "do not touch the column on this update").
  badgeTextColor?: string | null
}

export async function updateUserById(id: bigint, patch: UserUpdate): Promise<User | null> {
  const updated = await db.update(user).set(patch).where(eq(user.id, id)).returning()
  return updated[0] ?? null
}

// --- Admin user-management helpers ----------------------------------------
//
// Everything below this line is consumed by the wp-admin SPA only. The
// public site never references these helpers, so they can evolve
// independently without worrying about the public bundle surface.

export type UserRoleFilter = 'all' | 'admin' | 'normal'

export interface AdminUsersListFilters {
  q?: string
  role?: UserRoleFilter
  includeDeleted?: boolean
}

export interface AdminUserRow {
  id: bigint
  name: string
  email: string
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  badgeTextColor: string | null
  isAdmin: boolean
  isMuted: boolean
  emailVerified: boolean
  createdAt: Date
  deletedAt: Date | null
  lastIp: string | null
  lastUa: string | null
  commentCount: number
  pendingCount: number
  lastCommentAt: Date | null
}

function buildAdminUsersConditions(filters: AdminUsersListFilters) {
  const conditions = []
  if (!filters.includeDeleted) {
    conditions.push(isNull(user.deletedAt))
  }
  if (filters.role === 'admin') {
    conditions.push(eq(user.isAdmin, true))
  } else if (filters.role === 'normal') {
    // `is_admin` is nullable in legacy rows (default false), so we need
    // both branches to capture every non-admin user.
    conditions.push(or(eq(user.isAdmin, false), isNull(user.isAdmin)))
  }
  if (filters.q && filters.q.trim() !== '') {
    const like = `%${filters.q.trim()}%`
    conditions.push(or(sql`${user.name} ILIKE ${like}`, sql`${user.email} ILIKE ${like}`))
  }
  return conditions
}

export async function countAdminUsers(filters: AdminUsersListFilters): Promise<number> {
  const conditions = buildAdminUsersConditions(filters)
  const rows = await db
    .select({ counts: count() })
    .from(user)
    .where(conditions.length ? and(...conditions) : undefined)
  return rows[0]?.counts ?? 0
}

export type AdminUsersSortOrder = 'recent' | 'commentCount'

export async function listAdminUsers(
  offset: number,
  limit: number,
  filters: AdminUsersListFilters,
  sortBy: AdminUsersSortOrder = 'recent',
): Promise<AdminUserRow[]> {
  const conditions = buildAdminUsersConditions(filters)
  // Aggregate comment counts and last-comment timestamp per user via a
  // single LEFT JOIN + GROUP BY, so the listing query stays at one
  // round-trip even with the comment metadata columns.
  //
  // The aggregated `commentCount` column is reused by the optional
  // `commentCount` sort below — we name it explicitly with `sql.raw` so
  // we can ORDER BY the alias instead of repeating the FILTER clause
  // (PostgreSQL accepts `ORDER BY <alias>` after `GROUP BY`).
  const commentCountSql = sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL)`
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      link: user.link,
      badgeName: user.badgeName,
      badgeColor: user.badgeColor,
      badgeTextColor: user.badgeTextColor,
      isAdmin: user.isAdmin,
      isMuted: user.isMuted,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      lastIp: user.lastIp,
      lastUa: user.lastUa,
      commentCount: commentCountSql,
      pendingCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL AND ${comment.isPending} = TRUE)`,
      lastCommentAt: max(comment.createdAt),
    })
    .from(user)
    .leftJoin(comment, eq(comment.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(user.id)
    // Tiebreak with `user.id` desc in both modes so paginated results
    // stay deterministic when several users share the same primary key
    // (zero comments → identical `commentCount`; identical createdAt).
    .orderBy(
      ...(sortBy === 'commentCount' ? [desc(commentCountSql), desc(user.id)] : [desc(user.createdAt), desc(user.id)]),
    )
    .limit(limit)
    .offset(offset)

  return rows.map((row) => ({
    ...row,
    isAdmin: row.isAdmin ?? false,
    commentCount: Number(row.commentCount ?? 0),
    pendingCount: Number(row.pendingCount ?? 0),
  }))
}

export async function findAdminUserById(id: bigint): Promise<AdminUserRow | null> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      link: user.link,
      badgeName: user.badgeName,
      badgeColor: user.badgeColor,
      badgeTextColor: user.badgeTextColor,
      isAdmin: user.isAdmin,
      isMuted: user.isMuted,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      lastIp: user.lastIp,
      lastUa: user.lastUa,
      commentCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL)`,
      pendingCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL AND ${comment.isPending} = TRUE)`,
      lastCommentAt: max(comment.createdAt),
    })
    .from(user)
    .leftJoin(comment, eq(comment.userId, user.id))
    .where(eq(user.id, id))
    .groupBy(user.id)
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    isAdmin: row.isAdmin ?? false,
    commentCount: Number(row.commentCount ?? 0),
    pendingCount: Number(row.pendingCount ?? 0),
  }
}

export async function softDeleteUserById(id: bigint): Promise<boolean> {
  const updated = await db
    .update(user)
    .set({ deletedAt: new Date() })
    .where(and(eq(user.id, id), isNull(user.deletedAt)))
    .returning({ id: user.id })
  return updated.length > 0
}

export async function restoreUserById(id: bigint): Promise<boolean> {
  const updated = await db.update(user).set({ deletedAt: null }).where(eq(user.id, id)).returning({ id: user.id })
  return updated.length > 0
}

export async function setUserMuted(id: bigint, muted: boolean): Promise<User | null> {
  // Admins are exempt from muting; the admin UI hides the action, but
  // this guard makes the rule explicit at the storage boundary so it
  // cannot be bypassed by a hand-crafted API request.
  const updated = await db
    .update(user)
    .set({ isMuted: muted })
    .where(and(eq(user.id, id), or(eq(user.isAdmin, false), isNull(user.isAdmin))))
    .returning()
  return updated[0] ?? null
}
