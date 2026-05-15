import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { addMusicSchema } from '@/server/music/schema'
import { deleteMusicSchema } from '@/server/music/schema'
import { listMusicSchema } from '@/server/music/schema'
import { searchMusicSchema } from '@/server/music/schema'
import { updateMusicSchema } from '@/server/music/schema'
import { addMusic } from '@/server/music/service'
import { deleteMusic } from '@/server/music/service'
import { listMusicForAdmin } from '@/server/music/service'
import { searchMusic } from '@/server/music/service'
import { updateMusicMetadata } from '@/server/music/service'
import { userSession } from '@/server/session'
import { adminMusicContract } from '@/shared/contracts/admin/music'

export const adminMusicController: ContractImpl<typeof adminMusicContract> = {
  listMusic: async (args, ctx) => {
    const result = await listMusicForAdmin({
      q: args.query.q,
      offset: args.query.offset,
      limit: args.query.limit,
    })
    return { status: 200 as const, body: result }
  },
  searchMusic: async (args, ctx) => {
    const result = await searchMusic(args.query.keyword, args.query.limit)
    return { status: 200 as const, body: result }
  },
  addMusic: async (args, ctx) => {
    const music = await addMusic({
      source: args.body.source,
      sourceId: args.body.sourceId,
      uploader: { id: BigInt(ctx.viewer!.userId), name: userSession(ctx.session)?.name ?? '' },
    })
    return { status: 200 as const, body: { music } }
  },
  updateMusic: async (args, ctx) => {
    const music = await updateMusicMetadata({
      id: BigInt(args.params.id),
      name: args.body.name,
      artist: args.body.artist,
      album: args.body.album,
      lyric: args.body.lyric,
    })
    return { status: 200 as const, body: { music } }
  },
  deleteMusic: async (args, ctx) => {
    await deleteMusic(BigInt(args.params.id), { userId: ctx.viewer!.userId, role: ctx.viewer!.role })
    return { status: 200 as const, body: { success: true } }
  },
}
