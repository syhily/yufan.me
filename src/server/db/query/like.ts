import { and, count, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'

import { db } from '@/server/db/pool'
import { comment, like, page } from '@/server/db/schema'

/**
 * Atomic "register like + bump counter + read fresh count" in one transaction.
 *
 * Previously the like flow ran three separate round-trips (insertToken,
 * incrementPageVotes, queryLikes) which let a concurrent decrement land
 * between the bump and the read and report a stale count to the client.
 * The transaction guarantees the returned count reflects this exact
 * insert; downstream UPDATEs touching the same row queue behind it.
 */
export async function recordLikeAndCount(token: string, pageKey: string): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date()
    await tx.insert(like).values({ token, pageKey, createdAt: now, updatedAt: now })
    const rows = await tx
      .update(page)
      .set({ voteUp: sql`${page.voteUp} + 1` })
      .where(eq(page.key, pageKey))
      .returning({ voteUp: page.voteUp })
    return rows[0]?.voteUp ?? 0
  })
}

export async function findActiveLikeId(pageKey: string, token: string): Promise<bigint | null> {
  const rows = await db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey), isNull(like.deletedAt)))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function softDeleteLike(id: bigint): Promise<void> {
  const now = new Date()
  await db.update(like).set({ updatedAt: now, deletedAt: now }).where(eq(like.id, id))
}

export async function consumeActiveLikeToken(pageKey: string, token: string): Promise<boolean> {
  const now = new Date()
  const rows = await db
    .update(like)
    .set({ updatedAt: now, deletedAt: now })
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey), isNull(like.deletedAt)))
    .returning({ id: like.id })
  return rows.length > 0
}

export async function pageVoteUp(pageKey: string): Promise<number> {
  const rows = await db.select({ like: page.voteUp }).from(page).where(eq(page.key, pageKey)).limit(1)
  return rows[0]?.like ?? 0
}

export interface PageMetricsRow {
  key: string
  like: number | null
  view: number | null
}

export async function pageMetricsByKeys(pageKeys: string[]): Promise<PageMetricsRow[]> {
  if (pageKeys.length === 0) {
    return []
  }
  return db.select({ key: page.key, like: page.voteUp, view: page.pv }).from(page).where(inArray(page.key, pageKeys))
}

export interface PageCommentCountRow {
  pageKey: string
  count: number
}

export async function commentCountsByPageKeys(pageKeys: string[]): Promise<PageCommentCountRow[]> {
  if (pageKeys.length === 0) {
    return []
  }
  return db
    .select({ pageKey: comment.pageKey, count: count() })
    .from(comment)
    .where(and(inArray(comment.pageKey, pageKeys), eq(comment.isPending, false), isNull(comment.deletedAt)))
    .groupBy(comment.pageKey)
}

export async function purgeOldLikeTokens(before: Date): Promise<void> {
  await db.delete(like).where(and(isNotNull(like.deletedAt), lt(like.deletedAt, before)))
}

export async function existsActiveLikeToken(pageKey: string, token: string): Promise<boolean> {
  const rows = await db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey), isNull(like.deletedAt)))
    .limit(1)
  return rows.length > 0
}
