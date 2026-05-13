import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { listUsersSchema } from '@/server/users/schema'
import { listUsersForAdmin, toAdminUserDto } from '@/server/users/service'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: listUsersSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const result = await listUsersForAdmin(
      payload.offset,
      payload.limit,
      {
        q: payload.q,
        role: payload.role ?? 'all',
        includeDeleted: payload.includeDeleted ?? false,
        hasPosts: payload.hasPosts ?? false,
      },
      payload.sortBy ?? 'recent',
    )
    return {
      users: result.users.map(toAdminUserDto),
      total: result.total,
      hasMore: result.hasMore,
    }
  },
})
