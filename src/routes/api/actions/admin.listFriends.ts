import { listFriendsSchema } from '@/server/friends/schema'
import { listFriendsForAdmin } from '@/server/friends/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: listFriendsSchema,
  requireRole: 'admin',
  async run({ payload }) {
    return listFriendsForAdmin({
      q: payload.q,
      includeHidden: payload.includeHidden,
      offset: payload.offset,
      limit: payload.limit,
    })
  },
})
