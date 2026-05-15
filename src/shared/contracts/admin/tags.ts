import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const adminTagDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  postCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const listTagsResponse = z.object({ tags: z.array(adminTagDto), total: z.number(), hasMore: z.boolean() })

export const upsertTagResponse = z.object({ tag: adminTagDto })

export const deleteTagResponse = z.object({ success: z.boolean() })

export const adminTagsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/tags',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      responses: {
        200: listTagsResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：标签列表',
    },
    upsert: {
      method: 'POST',
      path: '/admin/tags',
      body: z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1).max(20),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
          .optional(),
      }),
      responses: {
        200: upsertTagResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：新建 / 更新标签',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/tags/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: deleteTagResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：删除标签',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
