import { eq, sql } from 'drizzle-orm'

import type { NewPage, Page } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { page } from '@/server/db/schema'

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
  if (delta <= 0) {
    return
  }
  await db
    .update(page)
    .set({ pv: sql`${page.pv} + ${delta}` })
    .where(eq(page.key, key))
}

/**
 * Apply many `pv += delta` updates in a single SQL statement using
 * `UPDATE ... FROM (VALUES ...)` so the round-trip count is one regardless of
 * batch size. Falls back early on an empty input.
 */
export async function incrementPageViewsBatch(deltas: Map<string, number>): Promise<void> {
  const positive = Array.from(deltas).filter(([, delta]) => delta > 0)
  if (positive.length === 0) {
    return
  }

  // Build `(?, ?), (?, ?), ...` rows with bound parameters — never inline
  // user-derived strings.
  const rows = sql.join(
    positive.map(([key, delta]) => sql`(${key}::varchar(255), ${delta}::bigint)`),
    sql`, `,
  )

  await db.execute(sql`
    UPDATE ${page}
    SET    pv = COALESCE(${page.pv}, 0) + v.delta
    FROM   (VALUES ${rows}) AS v(key, delta)
    WHERE  ${page.key} = v.key
  `)
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
    .set({ voteUp: sql`GREATEST(${page.voteUp} - 1, 0)` })
    .where(eq(page.key, key))
}
