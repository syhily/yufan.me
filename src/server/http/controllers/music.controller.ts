import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { publicProc } from '@/server/http/orpc-base'
import { getMusicMetaForPlayer } from '@/server/music/service'
import { publicMusicMetaDto } from '@/shared/contracts/music'

const get = publicProc
  .route({ method: 'GET', path: '/music/get' })
  .input(
    z.object({
      id: z
        .string()
        .trim()
        .regex(/^[a-z0-9]{16}$/, 'invalid player id'),
    }),
  )
  .output(z.object({ music: publicMusicMetaDto }))
  .handler(async ({ input }) => {
    const meta = await getMusicMetaForPlayer(input.id)
    if (meta === null) {
      throw new ORPCError('NOT_FOUND', { message: '音乐不存在或已下线' })
    }
    return { music: meta }
  })

export const musicRouter = { get }
