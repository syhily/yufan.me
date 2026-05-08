import { eq, sql } from 'drizzle-orm'

import type { NewPage, Page as MetricRow } from '@/server/db/types'

import { db } from '@/server/db/pool'
// `metric` is the business-layer alias for the historical page-counter
// table. The physical name and Drizzle export `page` are pinned in
// schema.ts; the alias is the single seam between "this file holds
// metric counters" and "the table is still called `page` on disk".
// When the follow-up PR drops `key`/`title` and renames the table to
// `metrics` the only edit needed here is changing this alias to point
// at the new export.
import { page as metricTable } from '@/server/db/schema'

export type { Page as MetricRow } from '@/server/db/types'

/**
 * Atomic upsert of a metric counter row by its unique `key`.
 *
 * - When the row does not yet exist we insert defaults.
 * - When it already exists and a non-null title is supplied we refresh the
 *   title (so a renamed post propagates to the metric table).
 * - When the row exists and `title` is null we touch `updated_at` so the
 *   RETURNING clause works without changing semantics.
 *
 * Implemented as a single `INSERT ... ON CONFLICT` to remove the previous
 * read-then-write race.
 */
export async function upsertMetric(key: string, title: string | null): Promise<MetricRow> {
  const np: NewPage = { title: title ?? '无标题', key, voteUp: 0, voteDown: 0, pv: 0 }
  const insert = db.insert(metricTable).values(np)
  const result =
    title !== null
      ? await insert
          .onConflictDoUpdate({
            target: metricTable.key,
            set: { title, updatedAt: new Date() },
          })
          .returning()
      : await insert
          .onConflictDoUpdate({
            target: metricTable.key,
            set: { updatedAt: sql`${metricTable.updatedAt}` },
          })
          .returning()
  return result[0]
}

export async function findMetricByKey(key: string): Promise<MetricRow | null> {
  const rows = await db.select().from(metricTable).where(eq(metricTable.key, key)).limit(1)
  return rows[0] ?? null
}

export async function incrementMetricPv(key: string, delta = 1): Promise<void> {
  if (delta <= 0) {
    return
  }
  await db
    .update(metricTable)
    .set({ pv: sql`${metricTable.pv} + ${delta}` })
    .where(eq(metricTable.key, key))
}

/**
 * Apply many `pv += delta` updates in a single SQL statement using
 * `UPDATE ... FROM (VALUES ...)` so the round-trip count is one regardless of
 * batch size. Falls back early on an empty input.
 */
export async function incrementMetricPvBatch(deltas: Map<string, number>): Promise<void> {
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
    UPDATE ${metricTable}
    SET    pv = COALESCE(${metricTable.pv}, 0) + v.delta
    FROM   (VALUES ${rows}) AS v(key, delta)
    WHERE  ${metricTable.key} = v.key
  `)
}

export async function incrementMetricVotes(key: string): Promise<void> {
  await db
    .update(metricTable)
    .set({ voteUp: sql`${metricTable.voteUp} + 1` })
    .where(eq(metricTable.key, key))
}

export async function decrementMetricVotes(key: string): Promise<void> {
  await db
    .update(metricTable)
    .set({ voteUp: sql`GREATEST(${metricTable.voteUp} - 1, 0)` })
    .where(eq(metricTable.key, key))
}
