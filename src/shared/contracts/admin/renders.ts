import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

export const adminRendersContract = c.router(
  {
    renderMath: {
      method: 'POST',
      path: '/admin/render-math',
      body: z.object({ tex: z.string(), display: z.boolean().optional() }),
      responses: { 200: z.object({ mathml: z.string(), error: z.string().nullable() }), ...standardMutationErrors },
      summary: 'renderMath',
    },
    renderMermaid: {
      method: 'POST',
      path: '/admin/render-mermaid',
      body: z.object({ code: z.string() }),
      responses: { 200: z.object({ svg: z.string(), error: z.string().nullable() }), ...standardMutationErrors },
      summary: 'renderMermaid',
    },
    reindexSearch: {
      method: 'POST',
      path: '/admin/reindex-search',
      body: z.object({ offset: z.number().optional(), batchSize: z.number().optional() }),
      responses: {
        200: z.object({
          processed: z.number(),
          failed: z.number(),
          total: z.number(),
          nextOffset: z.number().nullable(),
        }),
        ...standardMutationErrors,
      },
      summary: 'reindexSearch',
    },
  },
  { strictStatusCodes: true },
)
