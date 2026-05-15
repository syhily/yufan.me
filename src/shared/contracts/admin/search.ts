import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors } from '../_errors'

// ─── Schemas ────────────────────────────────────────────

const reindexBody = z.object({
  batchSize: z.number().int().min(1).max(50).default(5),
  offset: z.number().int().min(0).default(0),
})

const reindexResultSchema = z.object({
  processed: z.number(),
  failed: z.number(),
  total: z.number(),
  nextOffset: z.number().nullable(),
})

// ─── Contract ──────────────────────────────────────────

export const adminSearchContract = c.router(
  {
    reindex: {
      method: 'POST',
      path: '/admin/search/reindex',
      body: reindexBody,
      responses: {
        200: reindexResultSchema,
        ...standardMutationErrors,
      },
      summary: '管理后台：重建搜索索引',
    },
  },
  { strictStatusCodes: true },
)
