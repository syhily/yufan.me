import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { userSession } from '@/server/auth/primitives'
import { addMusic, deleteMusic, listMusicForAdmin, searchMusic, updateMusicMetadata } from '@/server/music/service'
import { adminMusicContract } from '@/shared/contracts/admin/music'

export const adminMusicController: AuthedContractImpl<typeof adminMusicContract> = {
  list: async (args, _ctx) => {
    const result = await listMusicForAdmin({
      q: args.query.q,
      offset: args.query.offset,
      limit: args.query.limit,
    })
    return { status: 200 as const, body: result }
  },
  search: async (args, _ctx) => {
    const result = await searchMusic(args.query.keyword, args.query.limit)
    return { status: 200 as const, body: result }
  },
  add: async (args, ctx) => {
    const music = await addMusic({
      source: args.body.source,
      sourceId: args.body.sourceId,
      uploader: { id: BigInt(ctx.viewer!.userId), name: userSession(ctx.session)?.name ?? '' },
    })
    return { status: 200 as const, body: { music } }
  },
  update: async (args, _ctx) => {
    const music = await updateMusicMetadata({
      id: BigInt(args.params.id),
      name: args.body.name,
      artist: args.body.artist,
      album: args.body.album,
      lyric: args.body.lyric ?? null,
    })
    return { status: 200 as const, body: { music } }
  },
  delete: async (args, ctx) => {
    await deleteMusic(BigInt(args.params.id), { userId: ctx.viewer!.userId, role: ctx.viewer!.role })
    return { status: 204 as const, body: undefined }
  },
}
