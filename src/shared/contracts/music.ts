import { z } from 'zod'

import type { PublicMusicMeta } from '@/shared/music'

import { c } from './_base'
import { standardReadErrors } from './_errors'

export const musicContract = c.router(
  {
    get: {
      method: 'GET',
      path: '/music/get',
      query: z.object({
        id: z
          .string()
          .trim()
          .regex(/^[a-z0-9]{16}$/, 'invalid player id'),
      }),
      responses: {
        200: z.object({ music: z.custom<PublicMusicMeta>() }),
        ...standardReadErrors,
      },
      summary: '获取音乐元数据（播放器用）',
    },
  },
  { strictStatusCodes: true },
)
