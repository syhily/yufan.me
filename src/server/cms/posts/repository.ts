import { and, asc, desc, eq, getColumns, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'

import type { NewPostMeta, PostMetaRow } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { post as postMetaTable, user } from '@/server/db/schema'

// Re-export shared content functions from the pages repository
export type { ContentType } from '@/server/cms/pages/repository'
export {
  findContentById,
  findContentsByIds,
  findLatestRevision,
  findLatestDraft,
  listRevisions,
  saveDraftRevision,
  publishLatestRevision,
  maxRevisionNo,
} from '@/server/cms/pages/repository'

// --- Reads -------------------------------------------------------------------

export type PostMetaWithAuthor = PostMetaRow & { authorName: string | null }

export interface ListPostsFilters {
  /** Free-text query matched case-insensitively against `slug` and `title`. */
  q?: string
  /** Deletion state filter. */
  deletedStatus?: 'all' | 'deleted' | 'normal'
  /** Zero-based offset for pagination. */
  offset?: number
  /** Page size. When undefined every match is returned. */
  limit?: number
  /** Filter by category name. */
  category?: string
  /** Filter by tag name (JSONB contains). */
  tag?: string
  /** Filter by published flag. */
  published?: boolean
  /** Filter by visible flag. */
  visible?: boolean
  /** Sort field. */
  sortBy?: 'publishedAt' | 'updatedAt'
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc'
  /** Filter by author id. */
  authorId?: bigint
}

function buildPostsWhere(filters: ListPostsFilters): SQL | undefined {
  const conditions: SQL[] = []
  if (filters.deletedStatus === 'deleted') {
    conditions.push(isNotNull(postMetaTable.deletedAt))
  } else if (filters.deletedStatus === 'normal') {
    conditions.push(isNull(postMetaTable.deletedAt))
  }
  if (filters.q && filters.q.trim() !== '') {
    const pattern = `%${filters.q.trim()}%`
    conditions.push(sql`(${postMetaTable.slug} ILIKE ${pattern} OR ${postMetaTable.title} ILIKE ${pattern})`)
  }
  if (filters.category) {
    conditions.push(eq(postMetaTable.category, filters.category))
  }
  if (filters.tag) {
    conditions.push(sql`${postMetaTable.tags} @> ${JSON.stringify([filters.tag])}::jsonb`)
  }
  if (filters.published !== undefined) {
    conditions.push(eq(postMetaTable.published, filters.published))
  }
  if (filters.visible !== undefined) {
    conditions.push(eq(postMetaTable.visible, filters.visible))
  }
  if (filters.authorId !== undefined) {
    conditions.push(eq(postMetaTable.authorId, filters.authorId))
  }
  if (conditions.length === 0) {
    return undefined
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}

function buildPostsOrderBy(filters: ListPostsFilters) {
  const col = filters.sortBy === 'updatedAt' ? postMetaTable.updatedAt : postMetaTable.firstPublishedAt
  return filters.sortOrder === 'asc' ? asc(col) : desc(col)
}

export async function listPostMetas(filters: ListPostsFilters = {}): Promise<PostMetaWithAuthor[]> {
  const where = buildPostsWhere(filters)
  const base = db
    .select({
      ...getColumns(postMetaTable),
      authorName: user.name,
    })
    .from(postMetaTable)
    .leftJoin(user, eq(user.id, postMetaTable.authorId))
    .orderBy(buildPostsOrderBy(filters))
  let q = where ? base.where(where) : base
  if (filters.limit !== undefined) {
    q = q.limit(filters.limit) as typeof q
  }
  if (filters.offset !== undefined && filters.offset > 0) {
    q = q.offset(filters.offset) as typeof q
  }
  return q
}

export async function countPostMetas(filters: ListPostsFilters = {}): Promise<number> {
  const where = buildPostsWhere(filters)
  const builder = where
    ? db
        .select({ count: sql<number>`count(*)::int` })
        .from(postMetaTable)
        .where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(postMetaTable)
  const rows = await builder
  return rows[0]?.count ?? 0
}

export async function findPostMetaById(id: bigint): Promise<PostMetaRow | null> {
  const rows = await db.select().from(postMetaTable).where(eq(postMetaTable.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findPostMetaBySlug(slug: string): Promise<PostMetaRow | null> {
  const rows = await db.select().from(postMetaTable).where(eq(postMetaTable.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function findPublicPostMetaBySlug(slug: string): Promise<PostMetaRow | null> {
  const rows = await db
    .select()
    .from(postMetaTable)
    .where(and(eq(postMetaTable.slug, slug), isNull(postMetaTable.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function listPublicPostMetas(sortBy: 'publishedAt' | 'updatedAt' = 'publishedAt'): Promise<PostMetaRow[]> {
  const col = sortBy === 'updatedAt' ? postMetaTable.updatedAt : postMetaTable.firstPublishedAt
  return db.select().from(postMetaTable).where(isNull(postMetaTable.deletedAt)).orderBy(desc(col))
}

// --- Public listing helpers (database-level pagination) ----------------------

export interface ListPublicPostsFilters {
  category?: string
  tag?: string
  includeHidden?: boolean
  includeScheduled?: boolean
  sortBy?: 'publishedAt' | 'updatedAt'
  limit?: number
  offset?: number
}

function buildPublicPostsWhere(filters: ListPublicPostsFilters): SQL {
  const conditions: SQL[] = [isNull(postMetaTable.deletedAt), eq(postMetaTable.published, true)]

  if (!filters.includeHidden) {
    conditions.push(eq(postMetaTable.visible, true))
  }
  if (!filters.includeScheduled) {
    conditions.push(sql`${postMetaTable.publishedAt} <= ${new Date()}`)
  }
  if (filters.category) {
    conditions.push(eq(postMetaTable.category, filters.category))
  }
  if (filters.tag) {
    conditions.push(sql`${postMetaTable.tags} @> ${JSON.stringify([filters.tag])}::jsonb`)
  }

  return and(...conditions)!
}

export async function listPublicPosts(filters: ListPublicPostsFilters = {}): Promise<PostMetaRow[]> {
  const col = filters.sortBy === 'updatedAt' ? postMetaTable.updatedAt : postMetaTable.firstPublishedAt
  const where = buildPublicPostsWhere(filters)
  let q = db.select().from(postMetaTable).where(where).orderBy(desc(col))
  if (filters.limit !== undefined) {
    q = q.limit(filters.limit) as typeof q
  }
  if (filters.offset !== undefined && filters.offset > 0) {
    q = q.offset(filters.offset) as typeof q
  }
  return q
}

export async function countPublicPosts(
  filters: Omit<ListPublicPostsFilters, 'sortBy' | 'limit' | 'offset'> = {},
): Promise<number> {
  const where = buildPublicPostsWhere(filters)
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postMetaTable)
    .where(where)
  return rows[0]?.count ?? 0
}

// --- Writes ------------------------------------------------------------------

export async function insertPostMeta(values: NewPostMeta): Promise<PostMetaRow> {
  const rows = await db.insert(postMetaTable).values(values).returning()
  return rows[0]
}

export async function updatePostMetaById(
  id: bigint,
  patch: Partial<Omit<NewPostMeta, 'id' | 'createdAt'>>,
): Promise<PostMetaRow | null> {
  const rows = await db
    .update(postMetaTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(postMetaTable.id, id))
    .returning()
  return rows[0] ?? null
}

export async function softDeletePostMeta(id: bigint): Promise<boolean> {
  const now = new Date()
  const rows = await db
    .update(postMetaTable)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(postMetaTable.id, id), isNull(postMetaTable.deletedAt)))
    .returning({ id: postMetaTable.id })
  return rows.length > 0
}

export async function restorePostMeta(id: bigint): Promise<boolean> {
  const rows = await db
    .update(postMetaTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(postMetaTable.id, id))
    .returning({ id: postMetaTable.id })
  return rows.length > 0
}
