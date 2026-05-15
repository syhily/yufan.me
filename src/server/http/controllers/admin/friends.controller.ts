import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { friendIdSchema } from '@/server/friends/schema'
import { listFriendsSchema } from '@/server/friends/schema'
import { upsertFriendSchema } from '@/server/friends/schema'
import { deleteAdminFriend } from '@/server/friends/service'
import { listFriendsForAdmin } from '@/server/friends/service'
import { upsertAdminFriend } from '@/server/friends/service'
import { userSession } from '@/server/session'
import { adminFriendsContract } from '@/shared/contracts/admin/friends'

export const adminFriendsController: ContractImpl<typeof adminFriendsContract> = {
  listFriends: async (args: any, ctx: any) => {
    const payload = args.query
    const result = await listFriendsForAdmin({
      q: payload.q,
      includeHidden: payload.includeHidden,
      offset: payload.offset,
      limit: payload.limit,
    })
    return { status: 200 as const, body: result }
  },
  upsertFriend: async (args: any, ctx: any) => {
    const payload = args.body
    const friend = await upsertAdminFriend({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      website: payload.website,
      description: payload.description ?? null,
      homepage: payload.homepage,
      poster: payload.poster,
      rssUrl: payload.rssUrl ?? null,
      visible: payload.visible,
    })
    return { status: 200 as const, body: { friend } }
  },
  deleteFriend: async (args: any, ctx: any) => {
    const ok = await deleteAdminFriend(BigInt(args.params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '友链不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
}
