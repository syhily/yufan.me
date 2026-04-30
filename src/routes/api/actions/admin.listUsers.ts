import { listUsersSchema } from '@/server/admin-users/schema'
import { listUsersForAdmin, toAdminUserDto } from '@/server/admin-users/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listUsersSchema,
  requireAdmin: true,
  async run({ payload }) {
    const result = await listUsersForAdmin(
      payload.offset,
      payload.limit,
      {
        q: payload.q,
        role: payload.role ?? 'all',
        includeDeleted: payload.includeDeleted ?? false,
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
