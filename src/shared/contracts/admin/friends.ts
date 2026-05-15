import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminFriendsContract = c.router(
  {
    listFriends: {
      method: 'GET',
      path: '/admin/list-friends',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listFriends',
    },
    upsertFriend: {
      method: 'POST',
      path: '/admin/upsert-friend',
      body: z.any() /* TODO: use upsertFriendSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertFriend',
    },
    deleteFriend: {
      method: 'DELETE',
      path: '/admin/delete-friend/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deleteFriend',
    },
  },
  { strictStatusCodes: true },
)
