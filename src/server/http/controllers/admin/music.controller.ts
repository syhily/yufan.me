import type { adminMusicContract } from '@/shared/contracts/admin/music'

import { requireViewer, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { addMusic, deleteMusic, listMusicForAdmin, searchMusic, updateMusicMetadata } from '@/server/music/service'
import { userSession } from '@/server/session'

export const adminMusicController: ContractImpl<typeof adminMusicContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { q?: string; offset?: number; limit?: number }
    const result = await listMusicForAdmin({ q: q.q, offset: q.offset, limit: q.limit })
    return { status: 200, body: result }
  },

  search: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { keyword: string; limit?: number }
    const result = await searchMusic(q.keyword, q.limit)
    return { status: 200, body: result }
  },

  add: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const adminUser = userSession(ctx.session)
    if (!adminUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    const body = args.body as { source: 'netease'; sourceId: string }
    const music = await addMusic({
      source: body.source,
      sourceId: body.sourceId,
      uploader: { id: BigInt(viewer.userId), name: adminUser.name },
    })
    return { status: 200, body: { music } }
  },

  update: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const body = args.body as { name: string; artist: string[]; album?: string; lyric?: string | null }
    const music = await updateMusicMetadata({
      id: BigInt(id),
      name: body.name,
      artist: body.artist,
      album: body.album ?? '',
      lyric: body.lyric ?? null,
    })
    return { status: 200, body: { music } }
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    await deleteMusic(BigInt(id), { userId: viewer.userId, role: viewer.role })
    return { status: 200, body: { success: true } }
  },
}
