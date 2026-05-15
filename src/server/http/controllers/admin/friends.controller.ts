import type { adminFriendsContract } from '@/shared/contracts/admin/friends'

import { deleteAdminFriend, listFriendsForAdmin, upsertAdminFriend } from '@/server/friends/service'
import { ok, notFound } from '@/server/http/response'
import { body, query, asId, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { ActionFailure } from '@/server/route-helpers/errors'

interface FriendsListQuery {
  q?: string
  includeHidden?: boolean
  offset?: number
  limit?: number
}

interface UpsertFriendBody {
  id?: string
  website: string
  description?: string
  homepage: string
  poster: string
  rssUrl?: string
  visible?: boolean
}

export const adminFriendsController: ContractImpl<typeof adminFriendsContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<FriendsListQuery>(args)
    const result = await listFriendsForAdmin({
      q: q.q,
      includeHidden: q.includeHidden,
      offset: q.offset,
      limit: q.limit,
    })
    return ok({ friends: result.friends, total: result.total, hasMore: result.hasMore })
  },

  upsert: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const b = body<UpsertFriendBody>(args)
      const friend = await upsertAdminFriend({
        id: b.id !== undefined ? asId(b.id) : undefined,
        website: b.website,
        description: b.description ?? null,
        homepage: b.homepage,
        poster: b.poster,
        rssUrl: b.rssUrl ?? null,
        visible: b.visible ?? true,
      })
      return ok({ friend })
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },

  delete: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const deleted = await deleteAdminFriend(asId(id))
    if (!deleted) {
      return notFound('友链不存在')
    }
    return ok({ success: true })
  },
}
