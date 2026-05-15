import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminCategoryDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminCategoriesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/categories',
      query: z.object({ q: z.string().optional() }),
      responses: {
        200: z.object({ categories: z.array(adminCategoryDto), total: z.number() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：分类列表',
    },
    upsert: {
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
      summary: '管理后台：新增 / 更新分类',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/categories/:id',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 204: c.noBody(), ...standardMutationErrors },
      summary: '管理后台：删除分类',
    },
    reorder: {
      method: 'POST',
      path: '/admin/categories/reorder',
      body: z.object({ orderedIds: z.array(z.string().min(1)).min(1).max(500) }),
      responses: { 200: z.object({ categories: z.array(adminCategoryDto) }), ...standardMutationErrors },
      summary: '管理后台：调整分类排序',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
