import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'

import type { PortableTextBody } from '@/shared/pt/schema'

import { db } from '@/server/db/pool'
import { content, post } from '@/server/db/schema'
import { getLogger } from '@/server/logger'
import { defineApiAction, ok } from '@/server/route-helpers/api-handler'
import { indexPost } from '@/server/search/indexer'

const reindexInputSchema = z.object({
  batchSize: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
})

export const action = defineApiAction({
  method: 'POST',
  requireRole: 'admin',
  input: reindexInputSchema,
  async run({ payload }) {
    const rows = await db
      .select({
        id: post.id,
        title: post.title,
        summary: post.summary,
        publishedRevisionId: post.publishedRevisionId,
      })
      .from(post)
      .where(and(isNull(post.deletedAt), eq(post.published, true), isNotNull(post.publishedRevisionId)))
      .orderBy(post.id)

    const total = rows.length

    const useBatching = payload.batchSize !== undefined || payload.offset !== undefined
    const offset = payload.offset ?? 0
    const batchSize = payload.batchSize ?? total
    const batch = useBatching ? rows.slice(offset, offset + batchSize) : rows

    const revisionIds = batch.map((r) => r.publishedRevisionId!).filter(Boolean)
    const contents =
      revisionIds.length > 0 ? await db.select().from(content).where(inArray(content.id, revisionIds)) : []
    const contentMap = new Map(contents.map((c) => [c.id, c]))

    let processed = 0
    let failed = 0
    for (const row of batch) {
      const rev = contentMap.get(row.publishedRevisionId!)
      if (rev) {
        try {
          await indexPost(row.id, row.title, row.summary, rev.body as PortableTextBody)
          processed++
        } catch (err) {
          getLogger('search.reindex').error('Index post failed', {
            postId: String(row.id),
            title: row.title,
            error: err instanceof Error ? err.message : String(err),
          })
          failed++
        }
      }
    }

    const nextOffset = useBatching && offset + batch.length < total ? offset + batch.length : null

    return ok({ processed, failed, total, nextOffset })
  },
})
