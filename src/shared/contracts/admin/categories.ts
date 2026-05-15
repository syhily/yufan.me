import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminCategoriesContract = c.router(
  {
    listCategories: {
      method: 'GET',
      path: '/admin/list-categories',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listCategories',
    },
    upsertCategory: {
      method: 'POST',
      path: '/admin/upsert-category',
      body: z.any() /* TODO: use upsertCategorySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertCategory',
    },
    deleteCategory: {
      method: 'DELETE',
      path: '/admin/delete-category/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deleteCategory',
    },
    reorderCategories: {
      method: 'POST',
      path: '/admin/reorder-categories',
      body: z.any() /* TODO: use reorderCategoriesSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'reorderCategories',
    },
  },
  { strictStatusCodes: true },
)
