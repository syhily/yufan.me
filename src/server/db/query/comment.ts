import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'

import type { Comment, NewComment } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { comment, page, user } from '@/server/db/schema'

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

// Pure type derived from the projection above via Drizzle's column-shape
// inference. Re-exported by `services/comments/types.ts` so downstream
// non-server code can refer to it without importing this `.server.ts`
// module directly. Inferring from the projection keeps the DTO and the
// SQL projection in lockstep — adding or removing a column from
// `commentWithUser` propagates to consumers automatically.
export type CommentWithUser = {
  [K in keyof typeof commentWithUser]: (typeof commentWithUser)[K]['_']['notNull'] extends true
    ? (typeof commentWithUser)[K]['_']['data']
    : (typeof commentWithUser)[K]['_']['data'] | null
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

// Computes both totals in a single round-trip using a filtered aggregate so
// loaders don't issue two near-identical queries on every comment render.
export async function countCommentsAndRoots(
  pageKey: string,
  pendingValues: boolean[],
): Promise<{ total: number; roots: number }> {
  const rows = await db
    .select({
      total: count(),
      roots: sql<number>`COUNT(*) FILTER (WHERE ${comment.rootId} = 0)`,
    })
    .from(comment)
    .where(and(eq(comment.pageKey, pageKey), inArray(comment.isPending, pendingValues)))
  const row = rows[0]
  return { total: Number(row.total), roots: Number(row.roots) }
}

export async function findRootComments(pageKey: string, pendingValues: boolean[], offset: number, limit: number) {
  // Secondary `desc(comment.id)` is the deterministic tiebreaker for
  // `createdAt` collisions (timestamps are millisecond-precision; a burst
  // of comments inside the same millisecond would otherwise have an
  // unstable order across paginated `loadComments` requests, which
  // surfaces as duplicate or missing rows on "load more"). `id` is
  // monotonic and cheap (already the primary key index).
  return db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, pageKey), eq(comment.rootId, 0n), inArray(comment.isPending, pendingValues)))
    .limit(limit)
    .orderBy(desc(comment.createdAt), desc(comment.id))
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

export async function recentCommentsForUserDedupe(userId: bigint, since: Date, limit: number) {
  // Scope the dedupe lookback to a single author so two unrelated commenters
  // posting "+1" minutes apart don't collide, and so a heavy commenter is
  // never blocked from intentionally repeating an older message they
  // themselves wrote outside the window. The legacy implementation queried
  // the 10 most-recent comments globally, which both over- and under-blocked.
  return db
    .select({ content: comment.content })
    .from(comment)
    .where(and(eq(comment.userId, userId), gte(comment.createdAt, since)))
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .limit(limit)
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
  status?: 'all' | 'pending' | 'approved'
}

function buildAdminListConditions(filters: AdminListFilters) {
  const conditions = [isNull(comment.deletedAt)]
  if (filters.pageKey) conditions.push(eq(comment.pageKey, filters.pageKey))
  if (filters.userId) conditions.push(eq(comment.userId, filters.userId))
  if (filters.status === 'pending') conditions.push(eq(comment.isPending, true))
  if (filters.status === 'approved') conditions.push(eq(comment.isPending, false))
  return conditions
}

export async function countAllComments(filters: AdminListFilters): Promise<number> {
  const conditions = buildAdminListConditions(filters)
  const rows = await db
    .select({ counts: count() })
    .from(comment)
    .where(and(...conditions))
  return rows[0].counts
}

export async function listAdminComments(offset: number, limit: number, filters: AdminListFilters) {
  const conditions = buildAdminListConditions(filters)
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
