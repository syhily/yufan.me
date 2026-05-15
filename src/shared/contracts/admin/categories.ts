import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminCategoryDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminCategoriesContract = c.router(
  {
    listCategories: {
      method: 'GET',
      path: '/admin/categories',
      query: z.object({ q: z.string().optional() }),
      responses: {
        200: z.object({ categories: z.array(adminCategoryDto), total: z.number() }),
        ...standardMutationErrors,
      },
      summary: 'listCategories',
    },
    upsertCategory: {
      method: 'POST',
      path: '/admin/categories',
      body: z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1).max(20),
        slug: z.string().optional(),
        cover: z.url().max(500),
        description: z.string().max(999).optional(),
        sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
      }),
      responses: { 200: z.object({ category: adminCategoryDto }), ...standardMutationErrors },
      summary: 'upsertCategory',
    },
    deleteCategory: {
      method: 'DELETE',
      path: '/admin/categories/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteCategory',
    },
    reorderCategories: {
      method: 'POST',
      path: '/admin/categories/reorder',
      body: z.object({ orderedIds: z.array(z.string().min(1)).min(1).max(500) }),
      responses: { 200: z.object({ categories: z.array(adminCategoryDto) }), ...standardMutationErrors },
      summary: 'reorderCategories',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
