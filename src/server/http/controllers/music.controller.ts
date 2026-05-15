import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { musicContract } from '@/shared/contracts/music'

import { ok, notFound } from '@/server/http/response'
import { query } from '@/server/http/ts-rest-adapter'
import { getMusicMetaForPlayer } from '@/server/music/service'

interface MusicGetQuery {
  id: string
}

export const musicController: ContractImpl<typeof musicContract> = {
  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<MusicGetQuery>(args)
    const meta = await getMusicMetaForPlayer(q.id)
    if (meta === null) {
      return notFound('音乐不存在或已下线')
    }
    return ok({ music: meta as unknown as Record<string, unknown> })
  },
}
