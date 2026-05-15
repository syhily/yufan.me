import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import type { adminSearchContract } from '@/shared/contracts/admin/search'

import { db } from '@/server/db/pool'
import { content, post } from '@/server/db/schema'
import { ok } from '@/server/http/response'
import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { getLogger } from '@/server/logger'
import { indexPost } from '@/server/search/indexer'

const log = getLogger('search.reindex')

export const adminSearchController: ContractImpl<typeof adminSearchContract> = {
  reindex: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const body = args.body as { batchSize: number; offset: number }

    // Total count of published posts
    const totalRows = await db
      .select({ total: count() })
      .from(post)
      .where(and(isNull(post.deletedAt), eq(post.published, true), isNotNull(post.publishedRevisionId)))
    const total = totalRows[0]?.total ?? 0

    // Fetch a batch of published posts with their content body
    const rows = await db
      .select({
        id: post.id,
        title: post.title,
        summary: post.summary,
        body: content.body,
        publishedRevisionId: post.publishedRevisionId,
      })
      .from(post)
      .innerJoin(content, eq(content.id, sql`${post.publishedRevisionId}`))
      .where(and(isNull(post.deletedAt), eq(post.published, true), isNotNull(post.publishedRevisionId)))
      .orderBy(post.id)
      .limit(body.batchSize)
      .offset(body.offset)

    let processed = 0
    let failed = 0

    for (const row of rows) {
      try {
        await indexPost(row.id, row.title, row.summary, row.body as any)
        processed++
      } catch (error) {
        failed++
        log.error('failed to reindex post', { postId: String(row.id), error })
      }
    }

    const nextOffset = body.offset + rows.length < total ? body.offset + rows.length : null

    return ok({
      processed,
      failed,
      total,
      nextOffset,
    })
  },
}
