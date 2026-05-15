import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminTagDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminTagsContract = c.router(
  {
    listTags: {
      method: 'GET',
      path: '/admin/tags',
      query: z.object({
        q: z.string().optional(),
        offset: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.object({ tags: z.array(adminTagDto), total: z.number(), hasMore: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: 'listTags',
    },
    upsertTag: {
      method: 'POST',
      path: '/admin/tags',
      body: z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1).max(20),
        slug: z.string().optional(),
      }),
      responses: { 200: z.object({ tag: adminTagDto }), ...standardMutationErrors },
      summary: 'upsertTag',
    },
    deleteTag: {
      method: 'DELETE',
      path: '/admin/tags/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteTag',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
