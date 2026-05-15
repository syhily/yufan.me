import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminFriendDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminFriendsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/friends',
      query: z.object({
        q: z.string().optional(),
        includeHidden: z.coerce.boolean().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
      responses: {
        200: z.object({ friends: z.array(adminFriendDto), total: z.number(), hasMore: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：友链列表',
    },
    upsert: {
      method: 'POST',
      path: '/admin/friends',
      body: z.object({
        id: z.string().min(1).optional(),
        website: z.string().trim().min(1).max(80),
        description: z.string().max(999).nullable().optional(),
        homepage: z.url().max(500),
        poster: z.url().max(500),
        rssUrl: z.union([z.url().max(500), z.literal(''), z.null()]).optional(),
        visible: z.boolean().optional().default(true),
      }),
      responses: { 200: z.object({ friend: adminFriendDto }), ...standardMutationErrors },
      summary: '管理后台：新增 / 更新友链',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/friends/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：删除友链',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
