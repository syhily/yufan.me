import { z } from 'zod'

import { c } from './_base'
import { standardReadErrors } from './_errors'

export const imageContract = c.router(
  {
    resolveThumbhash: {
      method: 'GET',
      path: '/image/thumbhash',
      query: z.object({
        src: z.string().trim().min(1).max(2000),
      }),
      responses: {
        200: z.object({
          thumbhash: z.string().nullable(),
          width: z.number().nullable(),
          height: z.number().nullable(),
        }),
        ...standardReadErrors,
      },
      summary: '解析图片 thumbhash、宽度和高度',
    },
  },
  { strictStatusCodes: true },
)
