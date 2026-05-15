import type { adminFriendsContract } from '@/shared/contracts/admin/friends'

import { deleteAdminFriend, listFriendsForAdmin, upsertAdminFriend } from '@/server/friends/service'
import { ok, notFound } from '@/server/http/response'
import { resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { ActionFailure } from '@/server/route-helpers/errors'

export const adminFriendsController: ContractImpl<typeof adminFriendsContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { q?: string; includeHidden?: boolean; offset?: number; limit?: number }
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
      const body = args.body as {
        id?: string
        website: string
        description?: string
        homepage: string
        poster: string
        rssUrl?: string
        visible?: boolean
      }
      const friend = await upsertAdminFriend({
        id: body.id !== undefined ? BigInt(body.id) : undefined,
        website: body.website,
        description: body.description ?? null,
        homepage: body.homepage,
        poster: body.poster,
        rssUrl: body.rssUrl ?? null,
        visible: body.visible ?? true,
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
    const deleted = await deleteAdminFriend(BigInt(id))
    if (!deleted) {
      return notFound('友链不存在')
    }
    return ok({ success: true })
  },
}
