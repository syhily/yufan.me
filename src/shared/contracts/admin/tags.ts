import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminTagsContract = c.router(
  {
    listTags: {
      method: 'GET',
      path: '/admin/list-tags',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listTags',
    },
    upsertTag: {
      method: 'POST',
      path: '/admin/upsert-tag',
      body: z.any() /* TODO: use upsertTagSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertTag',
    },
    deleteTag: {
      method: 'DELETE',
      path: '/admin/delete-tag/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deleteTag',
    },
  },
  { strictStatusCodes: true },
)
