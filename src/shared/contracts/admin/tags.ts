import { z } from 'zod'

import type { AdminTagDto } from '@/shared/tags'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminTagsContract = c.router(
  {
    listTags: {
      method: 'GET',
      path: '/admin/tags',
      query: z.object({ q: z.string().optional(), offset: z.number().optional(), limit: z.number().optional() }),
      responses: {
        200: z.object({ tags: z.array(z.custom<AdminTagDto>()), total: z.number(), hasMore: z.boolean() }),
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
      responses: { 200: z.object({ tag: z.custom<AdminTagDto>() }), ...standardMutationErrors },
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
  { strictStatusCodes: true },
)
