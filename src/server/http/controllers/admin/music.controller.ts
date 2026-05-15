import type { adminMusicContract } from '@/shared/contracts/admin/music'

import { ok, unauthorized } from '@/server/http/response'
import {
  body,
  query,
  asId,
  requireViewer,
  resolveId,
  type ContractImpl,
  type HandlerContext,
} from '@/server/http/ts-rest-adapter'
import { addMusic, deleteMusic, listMusicForAdmin, searchMusic, updateMusicMetadata } from '@/server/music/service'
import { userSession } from '@/server/session'

interface MusicListQuery {
  q?: string
  offset?: number
  limit?: number
}

interface MusicSearchQuery {
  keyword: string
  limit?: number
}

interface AddMusicBody {
  source: 'netease'
  sourceId: string
}

interface UpdateMusicBody {
  name: string
  artist: string[]
  album?: string
  lyric?: string | null
}

export const adminMusicController: ContractImpl<typeof adminMusicContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<MusicListQuery>(args)
    const result = await listMusicForAdmin({ q: q.q, offset: q.offset, limit: q.limit })
    return ok(result)
  },

  search: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<MusicSearchQuery>(args)
    const result = await searchMusic(q.keyword, q.limit)
    return ok(result)
  },

  add: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const adminUser = userSession(ctx.session)
    if (!adminUser) {
      return unauthorized()
    }
    const b = body<AddMusicBody>(args)
    const music = await addMusic({
      source: b.source,
      sourceId: b.sourceId,
      uploader: { id: asId(viewer.userId), name: adminUser.name },
    })
    return ok({ music })
  },

  update: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const b = body<UpdateMusicBody>(args)
    const music = await updateMusicMetadata({
      id: asId(id),
      name: b.name,
      artist: b.artist,
      album: b.album ?? '',
      lyric: b.lyric ?? null,
    })
    return ok({ music })
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    await deleteMusic(asId(id), { userId: viewer.userId, role: viewer.role })
    return ok({ success: true })
  },
}
