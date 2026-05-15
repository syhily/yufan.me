import { z } from 'zod'

import type { AdminCategoryDto } from '@/shared/categories'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminCategoriesContract = c.router(
  {
    listCategories: {
      method: 'GET',
      path: '/admin/list-categories',
      query: z.object({ q: z.string().optional() }),
      responses: {
        200: z.object({ categories: z.array(z.custom<AdminCategoryDto>()), total: z.number() }),
        ...standardMutationErrors,
      },
      summary: 'listCategories',
    },
    upsertCategory: {
      method: 'POST',
      path: '/admin/upsert-category',
      body: z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1).max(20),
        slug: z.string().optional(),
        cover: z.url().max(500),
        description: z.string().max(999).optional(),
        sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
      }),
      responses: { 200: z.object({ category: z.custom<AdminCategoryDto>() }), ...standardMutationErrors },
      summary: 'upsertCategory',
    },
    deleteCategory: {
      method: 'DELETE',
      path: '/admin/delete-category/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteCategory',
    },
    reorderCategories: {
      method: 'POST',
      path: '/admin/reorder-categories',
      body: z.object({ orderedIds: z.array(z.string().min(1)).min(1).max(500) }),
      responses: { 200: z.object({ categories: z.array(z.custom<AdminCategoryDto>()) }), ...standardMutationErrors },
      summary: 'reorderCategories',
    },
  },
  { strictStatusCodes: true },
)
