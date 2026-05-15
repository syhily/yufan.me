import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { musicContract } from '@/shared/contracts/music'

import { getMusicMetaForPlayer } from '@/server/music/service'

export const musicController: ContractImpl<typeof musicContract> = {
  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const query = args.query as { id: string }
    const meta = await getMusicMetaForPlayer(query.id)
    if (meta === null) {
      return { status: 404, body: { error: { message: '音乐不存在或已下线' } } }
    }
    return { status: 200, body: { music: meta as unknown as Record<string, unknown> } }
  },
}
