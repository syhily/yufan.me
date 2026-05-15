import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const adminCategoryDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  cover: z.string(),
  description: z.string(),
  sortOrder: z.number(),
  postCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminCategoriesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/categories',
      query: z.object({ q: z.string().trim().max(100).optional() }),
      responses: {
        200: z.object({ categories: z.array(adminCategoryDto), total: z.number() }),
        ...standardReadErrors,
      },
      summary: '管理后台：分类列表',
    },
    get: {
      method: 'GET',
      path: '/admin/categories/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: z.object({ category: adminCategoryDto }),
        ...standardReadErrors,
      },
      summary: '管理后台：分类详情',
    },
    create: {
      method: 'POST',
      path: '/admin/categories',
      body: z.object({
        name: z.string().trim().min(1).max(20),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
          .optional(),
        cover: z.string().max(500).pipe(z.url()),
        description: z.string().trim().max(999).optional(),
        sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
      }),
      responses: {
        200: z.object({ category: adminCategoryDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：新建分类',
    },
    update: {
      method: 'PATCH',
      path: '/admin/categories/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        name: z.string().trim().min(1).max(20).optional(),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
          .optional(),
        cover: z.string().max(500).pipe(z.url()).optional(),
        description: z.string().trim().max(999).optional(),
        sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
      }),
      responses: {
        200: z.object({ category: adminCategoryDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：更新分类',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/categories/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：删除分类',
    },
    reorder: {
      method: 'POST',
      path: '/admin/categories/reorder',
      body: z.object({ orderedIds: z.array(z.string().min(1)).min(1).max(500) }),
      responses: {
        200: z.object({ categories: z.array(adminCategoryDto) }),
        ...standardMutationErrors,
      },
      summary: '管理后台：分类排序',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
