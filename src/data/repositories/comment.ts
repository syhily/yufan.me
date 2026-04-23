import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { Comment, NewComment } from '@/data/db'

import { db, schema } from '@/data/db'

const { comment, page, user } = schema

// Common projection: every comment column we expose to the application,
// joined with the public user attributes. Keep the shape stable here so the
// CommentAndUser DTO upstream stays in sync via TypeScript inference.
const commentWithUser = {
  id: comment.id,
  createAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  deleteAt: comment.deletedAt,
  content: comment.content,
  pageKey: comment.pageKey,
  userId: comment.userId,
  isVerified: comment.isVerified,
  ua: comment.ua,
  ip: comment.ip,
  rid: comment.rid,
  isCollapsed: comment.isCollapsed,
  isPending: comment.isPending,
  isPinned: comment.isPinned,
  voteUp: comment.voteUp,
  voteDown: comment.voteDown,
  rootId: comment.rootId,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  link: user.link,
  badgeName: user.badgeName,
  badgeColor: user.badgeColor,
}

export interface PendingCommentRow {
  id: bigint
  page: string
  title: string | null
  author: string | null
  authorLink: string | null
}

export async function pendingComments(limit: number): Promise<PendingCommentRow[]> {
  return db
    .select({
      id: comment.id,
      page: comment.pageKey,
      title: page.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(page, eq(comment.pageKey, page.key))
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.isPending, true))
    .orderBy(desc(comment.id))
    .limit(limit)
}

export async function adminUserIds(): Promise<bigint[]> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true))
  return rows.map((r) => r.id)
}

export async function latestDistinctCommentIds(adminIds: bigint[], limit: number): Promise<bigint[]> {
  // Build a properly parameterized "exclude admins" predicate. Using
  // `sql.join` keeps each id as a bound parameter instead of dropping the
  // raw values into the query string.
  const userFilter = adminIds.length > 0 ? sql`${comment.userId} NOT IN (${sql.join(adminIds, sql`, `)})` : sql`1 = 1`
  const query = sql`SELECT    id
  FROM      (
            SELECT    id,
                      user_id,
                      created_at,
                      ROW_NUMBER() OVER (
                      PARTITION BY user_id
                      ORDER BY  created_at DESC
                      ) rn
            FROM      comment
            WHERE     ${userFilter}
            AND       is_pending = FALSE
            ) AS most_recent
  WHERE     rn = 1
  ORDER BY  created_at DESC
  LIMIT     ${limit}`
  const rows = (await db.execute(query)).rows
  return rows.map((row: { id: unknown }) => BigInt(String(row.id)))
}

export async function commentsByIds(ids: bigint[], limit: number): Promise<PendingCommentRow[]> {
  if (ids.length === 0) return []
  return db
    .select({
      id: comment.id,
      page: comment.pageKey,
      title: page.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(page, eq(comment.pageKey, page.key))
    .innerJoin(user, eq(comment.userId, user.id))
    .where(inArray(comment.id, ids))
    .orderBy(desc(comment.id))
    .limit(limit)
}

export async function countComments(pageKey: string, pendingValues: boolean[]): Promise<number> {
  return (
    await db
      .select({ counts: count() })
      .from(comment)
      .where(and(eq(comment.pageKey, pageKey), inArray(comment.isPending, pendingValues)))
  )[0].counts
}

export async function countRootComments(pageKey: string, pendingValues: boolean[]): Promise<number> {
  return (
    await db
      .select({ counts: count() })
      .from(comment)
      .where(and(eq(comment.pageKey, pageKey), inArray(comment.isPending, pendingValues), eq(comment.rootId, 0n)))
  )[0].counts
}

export async function findRootComments(pageKey: string, pendingValues: boolean[], offset: number, limit: number) {
  return db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, pageKey), eq(comment.rootId, 0n), inArray(comment.isPending, pendingValues)))
    .limit(limit)
    .orderBy(desc(comment.createdAt))
    .offset(offset)
}

export async function findChildComments(pageKey: string, pendingValues: boolean[], rootIds: bigint[]) {
  if (rootIds.length === 0) return []
  return db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(
      and(eq(comment.pageKey, pageKey), inArray(comment.isPending, pendingValues), inArray(comment.rootId, rootIds)),
    )
}

export async function approveCommentById(id: bigint): Promise<void> {
  await db.update(comment).set({ isPending: false }).where(eq(comment.id, id))
}

export async function findCommentWithUserAndPage(id: bigint) {
  const rows = await db
    .select()
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .innerJoin(page, eq(comment.pageKey, page.key))
    .where(eq(comment.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function deleteCommentById(id: bigint): Promise<void> {
  await db.delete(comment).where(eq(comment.id, id))
}

export async function findCommentRootId(id: bigint): Promise<bigint | null> {
  const rows = await db.select({ rootId: comment.rootId }).from(comment).where(eq(comment.id, id)).limit(1)
  return rows[0]?.rootId ?? null
}

export async function countApprovedCommentsByUser(userId: bigint): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(comment)
    .where(and(eq(comment.userId, userId), eq(comment.isPending, false)))
  return rows.length > 0 ? rows[0].count : 0
}

export async function recentCommentsForUserDedupe(limit: number) {
  // The previous implementation queried 10 most-recent comments across all
  // users for content-equality dedupe. We keep the behaviour but expose it
  // explicitly so the limit is no longer a hidden constant in the service.
  return db.select().from(comment).innerJoin(user, eq(comment.userId, user.id)).limit(limit)
}

export async function insertComment(values: NewComment): Promise<Comment | null> {
  const res = await db.insert(comment).values(values).returning()
  return res[0] ?? null
}

export async function findCommentWithUserById(id: bigint) {
  const rows = await db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function updateCommentContent(id: bigint, content: string): Promise<void> {
  await db.update(comment).set({ content }).where(eq(comment.id, id))
}

export async function findCommentWithSourceUser(id: bigint) {
  const rows = await db
    .select()
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.id, id))
    .limit(1)
  return rows[0] ?? null
}

export interface PageOption {
  key: string
  title: string
}

export async function listAllPages(): Promise<PageOption[]> {
  return db.select({ key: page.key, title: page.title }).from(page).where(isNull(page.deletedAt)).orderBy(desc(page.id))
}

export interface CommentAuthor {
  id: bigint
  name: string
}

export async function listCommentAuthors(): Promise<CommentAuthor[]> {
  return db
    .selectDistinct({ id: user.id, name: user.name })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(isNull(comment.deletedAt))
    .orderBy(user.id)
}

export interface AdminListFilters {
  pageKey?: string
  userId?: bigint
}

export async function countAllComments(filters: AdminListFilters): Promise<number> {
  const conditions = [isNull(comment.deletedAt)]
  if (filters.pageKey) conditions.push(eq(comment.pageKey, filters.pageKey))
  if (filters.userId) conditions.push(eq(comment.userId, filters.userId))
  const rows = await db
    .select({ counts: count() })
    .from(comment)
    .where(and(...conditions))
  return rows[0].counts
}

export async function listAdminComments(offset: number, limit: number, filters: AdminListFilters) {
  const conditions = [isNull(comment.deletedAt)]
  if (filters.pageKey) conditions.push(eq(comment.pageKey, filters.pageKey))
  if (filters.userId) conditions.push(eq(comment.userId, filters.userId))
  return db
    .select({ ...commentWithUser, pageTitle: page.title })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .leftJoin(page, eq(comment.pageKey, page.key))
    .where(and(...conditions))
    .orderBy(desc(comment.createdAt))
    .limit(limit)
    .offset(offset)
}
