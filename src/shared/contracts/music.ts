import { z } from 'zod'

import { c } from './_base'
import { publicMusicMetaDto } from './_dtos'
import { errorResponse, standardReadErrors } from './_errors'

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
        200: z.object({ music: publicMusicMetaDto }),
        ...standardReadErrors,
      },
      summary: '获取音乐元数据（播放器用）',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
