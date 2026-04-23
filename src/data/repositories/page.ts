import { eq, sql } from 'drizzle-orm'

import type { NewPage, Page } from '@/data/db'

import { db, schema } from '@/data/db'

const { page } = schema

/**
 * Atomic upsert of a page row by its unique `key`.
 *
 * - When the row does not yet exist we insert defaults.
 * - When it already exists and a non-null title is supplied we refresh the
 *   title (so a renamed post propagates to the metadata table).
 * - When the row exists and `title` is null we touch `updated_at` so the
 *   RETURNING clause works without changing semantics.
 *
 * Implemented as a single `INSERT ... ON CONFLICT` to remove the previous
 * read-then-write race.
 */
export async function upsertPage(key: string, title: string | null): Promise<Page> {
  const np: NewPage = { title: title ?? '无标题', key, voteUp: 0, voteDown: 0, pv: 0 }
  const insert = db.insert(page).values(np)
  const result =
    title !== null
      ? await insert
          .onConflictDoUpdate({
            target: page.key,
            set: { title, updatedAt: new Date() },
          })
          .returning()
      : await insert
          .onConflictDoUpdate({
            target: page.key,
            set: { updatedAt: sql`${page.updatedAt}` },
          })
          .returning()
  return result[0]
}

export async function findPageByKey(key: string): Promise<Page | null> {
  const rows = await db.select().from(page).where(eq(page.key, key)).limit(1)
  return rows[0] ?? null
}

export async function incrementPageViews(key: string, delta = 1): Promise<void> {
  if (delta <= 0) return
  await db
    .update(page)
    .set({ pv: sql`${page.pv} + ${delta}` })
    .where(eq(page.key, key))
}

/**
 * Apply many `pv += delta` updates within one DB transaction. The batcher
 * uses this to flush the in-memory counters accumulated between flushes.
 */
export async function incrementPageViewsBatch(deltas: Map<string, number>): Promise<void> {
  if (deltas.size === 0) return
  await db.transaction(async (tx) => {
    for (const [key, delta] of deltas) {
      if (delta <= 0) continue
      await tx
        .update(page)
        .set({ pv: sql`${page.pv} + ${delta}` })
        .where(eq(page.key, key))
    }
  })
}

export async function incrementPageVotes(key: string): Promise<void> {
  await db
    .update(page)
    .set({ voteUp: sql`${page.voteUp} + 1` })
    .where(eq(page.key, key))
}

export async function decrementPageVotes(key: string): Promise<void> {
  await db
    .update(page)
    .set({ voteUp: sql`${page.voteUp} - 1` })
    .where(eq(page.key, key))
}
