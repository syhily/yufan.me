import { z } from 'zod'

import { c } from './_base'
import { standardReadErrors } from './_errors'

export const musicGetQuery = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{16}$/, 'invalid player id'),
})

export const musicContract = c.router(
  {
    get: {
      method: 'GET',
      path: '/music',
      query: musicGetQuery,
      responses: {
        200: z.object({
          music: z.object({
            playerId: z.string(),
            name: z.string(),
            artist: z.array(z.string()),
            album: z.string(),
            cover: z.string().nullable(),
            audio: z.string().nullable(),
            lyric: z.string().nullable(),
          }),
        }),
        ...standardReadErrors,
      },
      summary: '获取音乐播放器元数据',
    },
  },
  { strictStatusCodes: true },
)
