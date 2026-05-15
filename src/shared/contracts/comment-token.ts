import { z } from 'zod'

import { c } from './_base'
import { commentItemDto } from './_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from './_errors'

const successResponse = z.object({ success: z.boolean() })

const myCommentsQuery = z.object({
  page_key: z.string(),
})

const myCommentsResponse = z.object({
  comments: z.array(commentItemDto),
  expiresAt: z.record(z.string(), z.number()),
})

export const commentTokenContract = c.router(
  {
    revokeToken: {
      method: 'POST',
      path: '/comment/tokens/revoke',
      body: z.object({ rid: z.string() }),
      responses: { 200: successResponse, ...standardMutationErrors },
      summary: '撤销匿名编辑令牌',
    },
    myComments: {
      method: 'GET',
      path: '/comment/mine',
      query: myCommentsQuery,
      responses: { 200: myCommentsResponse, ...standardReadErrors },
      summary: '获取当前访客的匿名评论',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
