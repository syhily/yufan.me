import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { deleteAdminFriend, listFriendsForAdmin, upsertAdminFriend } from '@/server/friends/service'
import { adminFriendsContract } from '@/shared/contracts/admin/friends'

export const adminFriendsController: AuthedContractImpl<typeof adminFriendsContract> = {
  list: async (args, _ctx) => {
    const payload = args.query
    const result = await listFriendsForAdmin({
      q: payload.q,
      includeHidden: payload.includeHidden,
      offset: payload.offset,
      limit: payload.limit,
    })
    return { status: 200 as const, body: result }
  },
  upsert: async (args, _ctx) => {
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
  delete: async (args, _ctx) => {
    const ok = await deleteAdminFriend(BigInt(args.params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '友链不存在' } } }
    }
    return { status: 204 as const, body: undefined }
  },
}
