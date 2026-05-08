import { listFriendsSchema } from '@/server/friends/schema'
import { listFriendsForAdmin } from '@/server/friends/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listFriendsSchema,
  requireAdmin: true,
  async run({ payload }) {
    return listFriendsForAdmin({
      q: payload.q,
      includeHidden: payload.includeHidden,
      offset: payload.offset,
      limit: payload.limit,
    })
  },
})
