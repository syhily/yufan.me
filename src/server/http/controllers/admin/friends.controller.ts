import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { deleteAdminFriend, listFriendsForAdmin, upsertAdminFriend } from '@/server/friends/service'
import { adminProc } from '@/server/http/orpc-base'
import { adminFriendDto } from '@/shared/contracts/_dtos'

const list = adminProc
  .input(
    z.object({
      q: z.string().optional(),
      includeHidden: z.coerce.boolean().optional(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    }),
  )
  .output(z.object({ friends: z.array(adminFriendDto), total: z.number(), hasMore: z.boolean() }))
  .handler(({ input }) =>
    listFriendsForAdmin({
      q: input.q,
      includeHidden: input.includeHidden,
      offset: input.offset,
      limit: input.limit,
    }),
  )

const upsert = adminProc
  .input(
    z.object({
      id: z.string().min(1).optional(),
      website: z.string().trim().min(1).max(80),
      description: z.string().max(999).nullable().optional(),
      homepage: z.url().max(500),
      poster: z.url().max(500),
      rssUrl: z.union([z.url().max(500), z.literal(''), z.null()]).optional(),
      visible: z.boolean().optional().default(true),
    }),
  )
  .output(z.object({ friend: adminFriendDto }))
  .handler(async ({ input }) => {
    const friend = await upsertAdminFriend({
      id: input.id !== undefined ? BigInt(input.id) : undefined,
      website: input.website,
      description: input.description ?? null,
      homepage: input.homepage,
      poster: input.poster,
      rssUrl: input.rssUrl ?? null,
      visible: input.visible,
    })
    return { friend }
  })

const remove = adminProc
  .input(z.object({ id: z.string().min(1) }))
  .output(z.void())
  .handler(async ({ input }) => {
    const ok = await deleteAdminFriend(BigInt(input.id))
    if (!ok) {
      throw new ORPCError('NOT_FOUND', { message: '友链不存在' })
    }
  })

export const adminFriendsRouter = { list, upsert, delete: remove }
