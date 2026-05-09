import { eq, sql } from 'drizzle-orm'

import type { MetricRow, NewMetric } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { metric } from '@/server/db/schema'

export type { MetricRow } from '@/server/db/types'

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
  const np: NewMetric = { title: title ?? '无标题', key, voteUp: 0, voteDown: 0, pv: 0 }
  const insert = db.insert(metric).values(np)
  const result =
    title !== null
      ? await insert
          .onConflictDoUpdate({
            target: metric.key,
            set: { title, updatedAt: new Date() },
          })
          .returning()
      : await insert
          .onConflictDoUpdate({
            target: metric.key,
            set: { updatedAt: sql`${metric.updatedAt}` },
          })
          .returning()
  return result[0]
}

export async function findMetricByKey(key: string): Promise<MetricRow | null> {
  const rows = await db.select().from(metric).where(eq(metric.key, key)).limit(1)
  return rows[0] ?? null
}

export async function incrementMetricPv(key: string, delta = 1): Promise<void> {
  if (delta <= 0) {
    return
  }
  await db
    .update(metric)
    .set({ pv: sql`${metric.pv} + ${delta}` })
    .where(eq(metric.key, key))
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
    UPDATE ${metric}
    SET    pv = COALESCE(${metric.pv}, 0) + v.delta
    FROM   (VALUES ${rows}) AS v(key, delta)
    WHERE  ${metric.key} = v.key
  `)
}

export async function incrementMetricVotes(key: string): Promise<void> {
  await db
    .update(metric)
    .set({ voteUp: sql`${metric.voteUp} + 1` })
    .where(eq(metric.key, key))
}

export async function decrementMetricVotes(key: string): Promise<void> {
  await db
    .update(metric)
    .set({ voteUp: sql`GREATEST(${metric.voteUp} - 1, 0)` })
    .where(eq(metric.key, key))
}
