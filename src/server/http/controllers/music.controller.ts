import type { PublicContractImpl } from '@/server/http/ts-rest-adapter'

import { getMusicMetaForPlayer } from '@/server/music/service'
import { musicContract } from '@/shared/contracts/music'

export const musicController: PublicContractImpl<typeof musicContract> = {
  get: async ({ query }: { query: { id: string } }) => {
    const meta = await getMusicMetaForPlayer(query.id)
    if (meta === null) {
      return { status: 404 as const, body: { error: { message: '音乐不存在或已下线' } } }
    }
    return {
      status: 200 as const,
      body: { music: meta },
      headers: {
        'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  },
}
