import { z } from 'zod'

import type { AdminFriendDto } from '@/shared/friends'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminFriendsContract = c.router(
  {
    listFriends: {
      method: 'GET',
      path: '/admin/friends',
      query: z.object({
        q: z.string().optional(),
        includeHidden: z.coerce.boolean().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
      responses: {
        200: z.object({ friends: z.array(z.custom<AdminFriendDto>()), total: z.number(), hasMore: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: 'listFriends',
    },
    upsertFriend: {
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
      responses: { 200: z.object({ friend: z.custom<AdminFriendDto>() }), ...standardMutationErrors },
      summary: 'upsertFriend',
    },
    deleteFriend: {
      method: 'DELETE',
      path: '/admin/friends/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteFriend',
    },
  },
  { strictStatusCodes: true },
)
