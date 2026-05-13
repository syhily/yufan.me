import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'

import type { EntityTarget, EntityType } from '@/server/db/target'
import type { Comment, NewComment } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { comment, metric, page, post, user } from '@/server/db/schema'

// Common projection: every comment column we expose to the application,
// joined with the public user attributes. Keep the shape stable here so the
// CommentAndUser DTO upstream stays in sync via TypeScript inference.
const commentWithUser = {
  id: comment.id,
  createAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  deleteAt: comment.deletedAt,
  content: comment.content,
  body: comment.body,
  type: comment.type,
  ownerId: comment.ownerId,
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
  deleteRequestedAt: comment.deleteRequestedAt,
  deleteRequestedBy: comment.deleteRequestedBy,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  link: user.link,
  badgeName: user.badgeName,
  badgeColor: user.badgeColor,
  badgeTextColor: user.badgeTextColor,
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

function whereTarget(target: EntityTarget) {
  return and(eq(comment.type, target.type), eq(comment.ownerId, target.ownerId))
}

export interface PendingCommentRow {
  id: bigint
  type: EntityType
  ownerId: bigint
  slug: string | null
  title: string | null
  author: string | null
  authorLink: string | null
}

// Post + page UNION used by `pendingComments` / `commentsByIds` and any
// admin surface that wants to project `(type, owner_id)` back to a
// human-readable slug + title without a polymorphic JOIN.
function targetSlugTitleSubquery() {
  return db
    .select({
      type: sql<EntityType>`'post'`.as('type'),
      ownerId: post.id,
      slug: post.slug,
      title: post.title,
    })
    .from(post)
    .unionAll(
      db
        .select({
          type: sql<EntityType>`'page'`.as('type'),
          ownerId: page.id,
          slug: page.slug,
          title: page.title,
        })
        .from(page),
    )
    .as('entity')
}

export async function pendingComments(limit: number): Promise<PendingCommentRow[]> {
  const entity = targetSlugTitleSubquery()
  const rows = await db
    .select({
      id: comment.id,
      type: comment.type,
      ownerId: comment.ownerId,
      slug: entity.slug,
      title: entity.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .leftJoin(entity, and(eq(entity.type, comment.type), eq(entity.ownerId, comment.ownerId)))
    .where(eq(comment.isPending, true))
    .orderBy(desc(comment.id))
    .limit(limit)
  return rows
    .filter((r) => r.type !== null && r.ownerId !== null)
    .map((r) => ({
      id: r.id,
      type: r.type as EntityType,
      ownerId: r.ownerId as bigint,
      slug: r.slug,
      title: r.title,
      author: r.author,
      authorLink: r.authorLink,
    }))
}

export async function adminUserIds(): Promise<bigint[]> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin'))
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
                      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
            FROM      ${comment}
            WHERE     is_pending = false
                AND   deleted_at IS NULL
                AND   ${userFilter}
            )         t
  WHERE     rn = 1
  ORDER BY  created_at DESC
  LIMIT     ${limit}`
  const rows = (await db.execute(query)).rows
  return rows.map((row: { id: unknown }) => BigInt(String(row.id)))
}

export async function commentsByIds(ids: bigint[], limit: number): Promise<PendingCommentRow[]> {
  if (ids.length === 0) {
    return []
  }
  const entity = targetSlugTitleSubquery()
  const rows = await db
    .select({
      id: comment.id,
      type: comment.type,
      ownerId: comment.ownerId,
      slug: entity.slug,
      title: entity.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .leftJoin(entity, and(eq(entity.type, comment.type), eq(entity.ownerId, comment.ownerId)))
    .where(inArray(comment.id, ids))
    .orderBy(desc(comment.id))
    .limit(limit)
  return rows
    .filter((r) => r.type !== null && r.ownerId !== null)
    .map((r) => ({
      id: r.id,
      type: r.type as EntityType,
      ownerId: r.ownerId as bigint,
      slug: r.slug,
      title: r.title,
      author: r.author,
      authorLink: r.authorLink,
    }))
}

// Computes both totals in a single round-trip using a filtered aggregate so
// loaders don't issue two near-identical queries on every comment render.
export async function countCommentsAndRoots(
  target: EntityTarget,
  pendingValues: boolean[],
): Promise<{ total: number; roots: number }> {
  const rows = await db
    .select({
      total: count(),
      roots: sql<number>`COUNT(*) FILTER (WHERE ${comment.rootId} = 0)`,
    })
    .from(comment)
    .where(and(whereTarget(target), inArray(comment.isPending, pendingValues)))
  const row = rows[0]
  return { total: Number(row.total), roots: Number(row.roots) }
}

export async function findRootComments(target: EntityTarget, pendingValues: boolean[], offset: number, limit: number) {
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
    .where(and(whereTarget(target), eq(comment.rootId, 0n), inArray(comment.isPending, pendingValues)))
    .limit(limit)
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .offset(offset)
}

export async function findChildComments(target: EntityTarget, pendingValues: boolean[], rootIds: bigint[]) {
  if (rootIds.length === 0) {
    return []
  }
  return db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(whereTarget(target), inArray(comment.isPending, pendingValues), inArray(comment.rootId, rootIds)))
}

export async function approveCommentById(id: bigint): Promise<void> {
  await db.update(comment).set({ isPending: false }).where(eq(comment.id, id))
}

export async function findCommentWithUserAndTarget(id: bigint) {
  const entity = targetSlugTitleSubquery()
  const rows = await db
    .select({
      comment,
      user,
      metric,
      entitySlug: entity.slug,
      entityTitle: entity.title,
    })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .innerJoin(metric, and(eq(metric.type, comment.type), eq(metric.ownerId, comment.ownerId)))
    .leftJoin(entity, and(eq(entity.type, comment.type), eq(entity.ownerId, comment.ownerId)))
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

export async function updateCommentBodyAndContent(
  id: bigint,
  body: NewComment['body'],
  content: string,
): Promise<void> {
  await db.update(comment).set({ body, content }).where(eq(comment.id, id))
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

export async function findCommentsByIds(ids: bigint[]) {
  if (ids.length === 0) {
    return []
  }
  return db
    .select(commentWithUser)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(inArray(comment.id, ids))
}

export interface PageOption {
  /** `metric.public_id`. Wire field is named `key` because the Combobox API stays stable. */
  key: string
  title: string
}

// Page-title autocomplete for the comment-moderation filter Combobox.
// `q` is matched case-insensitively against the entity's live title
// (joined from `post` / `page`). Empty `q` returns the most recently-
// touched entities so the dropdown can show a sensible default the
// moment the user opens it. `publicIds` is the "rehydrate selection
// from URL" path: when the admin opened
// `/wp-admin/comments?pageKey=<uuid>` we already know which metric row
// to pin, but need its `title` to render in the trigger.
export async function searchPages(q: string | undefined, limit: number, publicIds?: string[]): Promise<PageOption[]> {
  const entity = targetSlugTitleSubquery()
  const conditions = [isNull(metric.deletedAt), isNotNull(metric.type), isNotNull(metric.ownerId)]
  if (publicIds && publicIds.length > 0) {
    conditions.push(inArray(metric.publicId, publicIds))
  } else if (q) {
    conditions.push(ilike(entity.title, `%${q}%`))
  }
  const rows = await db
    .select({ key: metric.publicId, title: entity.title })
    .from(metric)
    .innerJoin(entity, and(eq(entity.type, metric.type), eq(entity.ownerId, metric.ownerId)))
    .where(and(...conditions))
    .orderBy(desc(metric.id))
    .limit(limit)
  return rows.map((r) => ({ key: r.key, title: r.title ?? '无标题' }))
}

export interface CommentAuthor {
  id: bigint
  name: string
}

// Comment-author autocomplete. We restrict to authors who have at least
// one non-deleted comment (same predicate as the original
// `listCommentAuthors`) so the dropdown only ever surfaces names the
// admin actually has comments to filter by. `q` matches against
// `user.name` case-insensitively. When `ids` is supplied we instead do
// an exact id-match — this is the "rehydrate selection from URL" path
// where the client only knows the user id (e.g. from `?userId=2232`)
// and needs the matching `name` to render in the Combobox trigger.
export async function searchCommentAuthors(
  q: string | undefined,
  limit: number,
  ids?: bigint[],
): Promise<CommentAuthor[]> {
  const conditions = [isNull(comment.deletedAt)]
  if (ids && ids.length > 0) {
    conditions.push(inArray(user.id, ids))
  } else if (q) {
    conditions.push(ilike(user.name, `%${q}%`))
  }
  return db
    .selectDistinct({ id: user.id, name: user.name })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(...conditions))
    .orderBy(user.id)
    .limit(limit)
}

export interface AdminListFilters {
  target?: EntityTarget
  userId?: bigint
  status?: 'all' | 'pending' | 'approved'
}

function buildAdminListConditions(filters: AdminListFilters) {
  const conditions = [isNull(comment.deletedAt)]
  if (filters.target) {
    conditions.push(eq(comment.type, filters.target.type), eq(comment.ownerId, filters.target.ownerId))
  }
  if (filters.userId) {
    conditions.push(eq(comment.userId, filters.userId))
  }
  if (filters.status === 'pending') {
    conditions.push(eq(comment.isPending, true))
  }
  if (filters.status === 'approved') {
    conditions.push(eq(comment.isPending, false))
  }
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
  const entity = targetSlugTitleSubquery()
  return db
    .select({ ...commentWithUser, pageTitle: entity.title, pagePublicId: metric.publicId })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .leftJoin(entity, and(eq(entity.type, comment.type), eq(entity.ownerId, comment.ownerId)))
    .leftJoin(metric, and(eq(metric.type, comment.type), eq(metric.ownerId, comment.ownerId)))
    .where(and(...conditions))
    .orderBy(desc(comment.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function bulkApprovePendingByUser(userId: bigint): Promise<number> {
  // Returns the number of pending comments that were just approved.
  const updated = await db
    .update(comment)
    .set({ isPending: false })
    .where(and(eq(comment.userId, userId), eq(comment.isPending, true), isNull(comment.deletedAt)))
    .returning({ id: comment.id })
  return updated.length
}

export async function bulkSoftDeleteCommentsByUser(userId: bigint): Promise<number> {
  // Soft-deletion mirrors the per-row delete used by the existing admin
  // page. We avoid the hard `DELETE` so moderation actions remain
  // recoverable and downstream like-counts stay consistent.
  const updated = await db
    .update(comment)
    .set({ deletedAt: new Date() })
    .where(and(eq(comment.userId, userId), isNull(comment.deletedAt)))
    .returning({ id: comment.id })
  return updated.length
}

export async function loadOwnedCommentOr404(id: bigint, expectedUserId: bigint) {
  const row = await findCommentWithUserById(id)
  if (row === null) {
    return null
  }
  if (row.userId !== expectedUserId) {
    return null
  }
  return row
}

export async function requestDeleteComment(id: bigint, byUserId: bigint): Promise<boolean> {
  const updated = await db
    .update(comment)
    .set({ deleteRequestedAt: new Date(), deleteRequestedBy: byUserId })
    .where(and(eq(comment.id, id), isNull(comment.deleteRequestedAt)))
    .returning({ id: comment.id })
  return updated.length > 0
}

export async function clearDeleteRequest(id: bigint): Promise<boolean> {
  const updated = await db
    .update(comment)
    .set({ deleteRequestedAt: null, deleteRequestedBy: null })
    .where(and(eq(comment.id, id), isNotNull(comment.deleteRequestedAt)))
    .returning({ id: comment.id })
  return updated.length > 0
}

export async function countApprovedRepliesOfComment(rootId: bigint): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(comment)
    .where(and(eq(comment.rootId, rootId), eq(comment.isPending, false), isNull(comment.deletedAt)))
  return rows[0]?.count ?? 0
}

export async function listMyComments(
  userId: bigint,
  options: { offset?: number; limit?: number },
): Promise<{ rows: CommentWithUser[]; total: number }> {
  const offset = options.offset ?? 0
  const limit = options.limit ?? 20
  const [result, total] = await Promise.all([
    db
      .select(commentWithUser)
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .where(and(eq(comment.userId, userId), isNull(comment.deletedAt)))
      .orderBy(desc(comment.createdAt), desc(comment.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(comment)
      .where(and(eq(comment.userId, userId), isNull(comment.deletedAt))),
  ])
  return { rows: result, total: total[0]?.count ?? 0 }
}

export async function countDeleteRequests(): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(comment)
    .where(and(isNotNull(comment.deleteRequestedAt), isNull(comment.deletedAt)))
  return rows[0]?.count ?? 0
}

export async function listDeleteRequests(offset: number, limit: number) {
  const entity = targetSlugTitleSubquery()
  return db
    .select({ ...commentWithUser, pageTitle: entity.title, pagePublicId: sql<string>`${metric.publicId}` })
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .leftJoin(entity, and(eq(entity.type, comment.type), eq(entity.ownerId, comment.ownerId)))
    .leftJoin(metric, and(eq(metric.type, comment.type), eq(metric.ownerId, comment.ownerId)))
    .where(and(isNotNull(comment.deleteRequestedAt), isNull(comment.deletedAt)))
    .orderBy(desc(comment.deleteRequestedAt))
    .limit(limit)
    .offset(offset)
}

export async function countMyComments(
  userId: bigint,
): Promise<{ total: number; pending: number; deleteRequested: number }> {
  const rows = await db
    .select({
      total: count(),
      pending: sql<number>`COUNT(*) FILTER (WHERE ${comment.isPending} = TRUE)`,
      deleteRequested: sql<number>`COUNT(*) FILTER (WHERE ${comment.deleteRequestedAt} IS NOT NULL)`,
    })
    .from(comment)
    .where(and(eq(comment.userId, userId), isNull(comment.deletedAt)))
  const row = rows[0]
  return {
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    deleteRequested: Number(row?.deleteRequested ?? 0),
  }
}

// Suppress unused-import warning: `or` is re-exported for callers that
// still need it; keep it imported via barrel.
export const _drizzleOr = or
