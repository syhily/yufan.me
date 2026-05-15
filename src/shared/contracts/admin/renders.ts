import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

export const adminRendersContract = c.router(
  {
    math: {
      method: 'POST',
      path: '/admin/renders/math',
      body: z.object({ tex: z.string(), display: z.boolean().optional() }),
      responses: { 200: z.object({ mathml: z.string(), error: z.string().nullable() }), ...standardMutationErrors },
      summary: '管理后台：服务端渲染 MathML',
    },
    mermaid: {
      method: 'POST',
      path: '/admin/renders/mermaid',
      body: z.object({ code: z.string() }),
      responses: { 200: z.object({ svg: z.string(), error: z.string().nullable() }), ...standardMutationErrors },
      summary: '管理后台：服务端渲染 Mermaid',
    },
    reindexSearch: {
      method: 'POST',
      path: '/admin/renders/reindex-search',
      body: z.object({ offset: z.coerce.number().optional(), batchSize: z.coerce.number().optional() }),
      responses: {
        200: z.object({
          processed: z.coerce.number(),
          failed: z.coerce.number(),
          total: z.coerce.number(),
          nextOffset: z.coerce.number().nullable(),
        }),
        ...standardMutationErrors,
      },
      summary: '管理后台：重建搜索索引',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
