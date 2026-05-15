import { z } from 'zod'

import { c } from './_base'
import { errorResponse, standardReadErrors } from './_errors'

export const resolveThumbhashQuery = z.object({
  src: z.string().trim().min(1).max(2000),
})

export const imageContract = c.router(
  {
    resolveThumbhash: {
      method: 'GET',
      path: '/image/thumbhash',
      query: resolveThumbhashQuery,
      responses: {
        200: z.object({
          thumbhash: z.string().nullable(),
          width: z.number().nullable(),
          height: z.number().nullable(),
        }),
        ...standardReadErrors,
      },
      summary: '根据图片 URL 查询缓存的 thumbhash',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
