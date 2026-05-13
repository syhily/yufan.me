import bcrypt from 'bcryptjs'
import { and, count, desc, eq, isNull, ne, or, sql } from 'drizzle-orm'

import type { NewUser, User } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { comment, post, user } from '@/server/db/schema'
import { getBlogSettingsBundleSync } from '@/shared/blog-config'

const PASSWORD_HASH_ROUNDS = 12

export async function hasAdmin(): Promise<boolean> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.role, 'admin'))
  return res.length > 0 && res[0].count > 0
}

export async function countAdmins(): Promise<number> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.role, 'admin'))
  return res[0]?.count ?? 0
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ?? null
}

export async function findUserById(id: bigint): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.id, id)).limit(1)
  return rows[0] ?? null
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const u = await findUserByEmail(email)
  if (u === null) {
    return null
  }
  return (await bcrypt.compare(password, u.password)) ? u : null
}

export async function verifyUserPasswordById(id: bigint, password: string): Promise<boolean> {
  const u = await findUserById(id)
  if (u === null) {
    return false
  }
  return bcrypt.compare(password, u.password)
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ? `${rows[0].id}` : null
}

export async function findEmailById(id: bigint): Promise<string | null> {
  const rows = await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1)
  return rows[0]?.email ?? null
}

export async function updateUserPasswordById(id: bigint, newPassword: string): Promise<void> {
  const hashedPassword = bcrypt.hashSync(newPassword, PASSWORD_HASH_ROUNDS)
  await db.update(user).set({ password: hashedPassword }).where(eq(user.id, id))
}

export interface InsertAdminOptions {
  link?: string
}

export async function insertAdmin(
  name: string,
  email: string,
  password: string,
  options: InsertAdminOptions = {},
): Promise<User[]> {
  const hashedPassword = bcrypt.hashSync(password, PASSWORD_HASH_ROUNDS)
  const admin: NewUser = {
    name,
    email,
    emailVerified: false,
    link: options.link ?? getBlogSettingsBundleSync()?.siteIdentity?.website ?? '',
    role: 'admin',
    password: hashedPassword,
    badgeName: 'MOD',
    badgeColor: '#008c95',
    receiveEmail: true,
  }
  return db.insert(user).values(admin).returning()
}

export async function insertAuthor(name: string, email: string): Promise<User> {
  const author: NewUser = {
    name,
    email,
    emailVerified: false,
    role: 'author',
    password: '',
    link: '',
    badgeName: 'AUTHOR',
    badgeColor: '#6366f1',
    receiveEmail: true,
  }
  const rows = await db.insert(user).values(author).returning()
  return rows[0]
}

export async function insertCommentUser(name: string, email: string, website: string): Promise<User | null> {
  const existing = await findUserByEmail(email)
  if (existing !== null) {
    return existing
  }
  const u: NewUser = {
    name,
    email,
    emailVerified: false,
    link: website,
    role: null,
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
  badgeTextColor?: string | null
}

export async function updateUserById(id: bigint, patch: UserUpdate): Promise<User | null> {
  const updated = await db.update(user).set(patch).where(eq(user.id, id)).returning()
  return updated[0] ?? null
}

// --- Role helpers --------------------------------------------------------

export async function updateUserRole(id: bigint, role: 'admin' | 'author' | 'visitor' | null): Promise<User | null> {
  const updated = await db.update(user).set({ role }).where(eq(user.id, id)).returning()
  return updated[0] ?? null
}

// --- Admin user-management helpers ----------------------------------------

export type UserRoleFilter = 'all' | 'admin' | 'author' | 'visitor' | 'normal'

export interface AdminUsersListFilters {
  q?: string
  role?: UserRoleFilter
  includeDeleted?: boolean
  hasPosts?: boolean
}

export interface AdminUserRow {
  id: bigint
  name: string
  email: string
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  badgeTextColor: string | null
  role: 'admin' | 'author' | 'visitor' | null
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
    conditions.push(eq(user.role, 'admin'))
  } else if (filters.role === 'author') {
    conditions.push(eq(user.role, 'author'))
  } else if (filters.role === 'visitor') {
    conditions.push(eq(user.role, 'visitor'))
  } else if (filters.role === 'normal') {
    // Non-admin users
    conditions.push(or(eq(user.role, 'author'), eq(user.role, 'visitor'), isNull(user.role)))
  }
  if (filters.q && filters.q.trim() !== '') {
    const like = `%${filters.q.trim()}%`
    conditions.push(or(sql`${user.name} ILIKE ${like}`, sql`${user.email} ILIKE ${like}`))
  }
  if (filters.hasPosts) {
    conditions.push(sql`EXISTS (SELECT 1 FROM ${post} WHERE ${eq(post.authorId, user.id)})`)
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

function lastCommentAtAggregate() {
  return sql<Date>`MAX(${comment.createdAt})`.mapWith((value: Date | string) =>
    value instanceof Date ? value : new Date(value),
  )
}

export async function listAdminUsers(
  offset: number,
  limit: number,
  filters: AdminUsersListFilters,
  sortBy: AdminUsersSortOrder = 'recent',
): Promise<AdminUserRow[]> {
  const conditions = buildAdminUsersConditions(filters)
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
      role: user.role,
      isMuted: user.isMuted,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      lastIp: user.lastIp,
      lastUa: user.lastUa,
      commentCount: commentCountSql,
      pendingCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL AND ${comment.isPending} = TRUE)`,
      lastCommentAt: lastCommentAtAggregate(),
    })
    .from(user)
    .leftJoin(comment, eq(comment.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(user.id)
    .orderBy(
      ...(sortBy === 'commentCount' ? [desc(commentCountSql), desc(user.id)] : [desc(user.createdAt), desc(user.id)]),
    )
    .limit(limit)
    .offset(offset)

  return rows.map((row) => ({
    ...row,
    role: row.role ?? null,
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
      role: user.role,
      isMuted: user.isMuted,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      lastIp: user.lastIp,
      lastUa: user.lastUa,
      commentCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL)`,
      pendingCount: sql<number>`COUNT(${comment.id}) FILTER (WHERE ${comment.deletedAt} IS NULL AND ${comment.isPending} = TRUE)`,
      lastCommentAt: lastCommentAtAggregate(),
    })
    .from(user)
    .leftJoin(comment, eq(comment.userId, user.id))
    .where(eq(user.id, id))
    .groupBy(user.id)
    .limit(1)
  const row = rows[0]
  if (!row) {
    return null
  }
  return {
    ...row,
    role: row.role ?? null,
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
  const updated = await db
    .update(user)
    .set({ isMuted: muted })
    .where(and(eq(user.id, id), ne(user.role, 'admin')))
    .returning()
  return updated[0] ?? null
}
