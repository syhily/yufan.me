import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const adminFriendDto = z.object({
  id: z.string(),
  website: z.string(),
  description: z.string().nullable(),
  homepage: z.string(),
  poster: z.string(),
  rssUrl: z.string().nullable(),
  visible: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const listFriendsResponse = z.object({
  friends: z.array(adminFriendDto),
  total: z.number(),
  hasMore: z.boolean(),
})

export const upsertFriendResponse = z.object({ friend: adminFriendDto })

export const deleteFriendResponse = z.object({ success: z.boolean() })

export const adminFriendsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/friends',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        includeHidden: z.coerce.boolean().optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      responses: {
        200: listFriendsResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：友链列表',
    },

    upsert: {
      method: 'POST',
      path: '/admin/friends',
      body: z.object({
        id: z.string().min(1).optional(),
        website: z.string().trim().min(1).max(80),
        description: z.string().trim().max(999).optional(),
        homepage: z.string().max(500).pipe(z.url()),
        poster: z.string().max(500).pipe(z.url()),
        rssUrl: z.union([z.string().max(500).pipe(z.url()), z.literal('')]).optional(),
        visible: z.boolean().optional().default(true),
      }),
      responses: {
        200: upsertFriendResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：创建或更新友链',
    },

    delete: {
      method: 'DELETE',
      path: '/admin/friends/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: deleteFriendResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：删除友链',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
