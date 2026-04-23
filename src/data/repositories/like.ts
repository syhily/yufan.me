import { and, count, eq, inArray, isNull, lt } from 'drizzle-orm'

import { db, schema } from '@/data/db'

const { comment, like, page } = schema

export async function insertLikeToken(token: string, pageKey: string): Promise<void> {
  const now = new Date()
  await db.insert(like).values({
    token,
    pageKey,
    createdAt: now,
    updatedAt: now,
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

export async function pageVoteUp(pageKey: string): Promise<number> {
  const rows = await db.select({ like: page.voteUp }).from(page).where(eq(page.key, pageKey)).limit(1)
  return rows[0]?.like ?? 0
}

export async function pageVoteUpAndViews(pageKey: string): Promise<[number, number]> {
  const rows = await db.select({ like: page.voteUp, view: page.pv }).from(page).where(eq(page.key, pageKey)).limit(1)
  return rows.length > 0 ? [rows[0].like ?? 0, rows[0].view ?? 0] : [0, 0]
}

export interface PageMetricsRow {
  key: string
  like: number | null
  view: number | null
}

export async function pageMetricsByKeys(pageKeys: string[]): Promise<PageMetricsRow[]> {
  if (pageKeys.length === 0) return []
  return db.select({ key: page.key, like: page.voteUp, view: page.pv }).from(page).where(inArray(page.key, pageKeys))
}

export interface PageCommentCountRow {
  pageKey: string
  count: number
}

export async function commentCountsByPageKeys(pageKeys: string[]): Promise<PageCommentCountRow[]> {
  if (pageKeys.length === 0) return []
  return db
    .select({ pageKey: comment.pageKey, count: count() })
    .from(comment)
    .where(and(inArray(comment.pageKey, pageKeys), eq(comment.isPending, false), isNull(comment.deletedAt)))
    .groupBy(comment.pageKey)
}

export async function purgeOldLikeTokens(before: Date): Promise<void> {
  await db.delete(like).where(lt(like.createdAt, before))
}

export async function existsLikeToken(pageKey: string, token: string): Promise<boolean> {
  const rows = await db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey)))
    .limit(1)
  return rows.length > 0
}
