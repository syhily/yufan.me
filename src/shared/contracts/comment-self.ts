import { z } from 'zod'

import { commentBodySchema } from '@/shared/pt/comment-schema'

import { c } from './_base'
import { commentItemDto } from './_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from './_errors'

const successResponse = z.object({ success: z.boolean() })

const listMineQuery = z.object({
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(20),
})

const listMineResponse = z.object({
  comments: z.array(commentItemDto),
  total: z.number().int(),
  pending: z.number().int(),
  deleteRequested: z.number().int(),
  hasMore: z.boolean(),
})

export const commentSelfContract = c.router(
  {
    updateOwn: {
      method: 'POST',
      path: '/comment/own/update',
      body: z.object({ commentId: z.string(), body: commentBodySchema }),
      responses: { 200: successResponse, ...standardMutationErrors },
      summary: '访客修改自己的评论',
    },
    requestDeleteOwn: {
      method: 'POST',
      path: '/comment/own/delete-request',
      body: z.object({ commentId: z.string() }),
      responses: { 200: successResponse, ...standardMutationErrors },
      summary: '访客请求删除自己的评论',
    },
    cancelDeleteOwn: {
      method: 'POST',
      path: '/comment/own/delete-cancel',
      body: z.object({ commentId: z.string() }),
      responses: { 200: successResponse, ...standardMutationErrors },
      summary: '访客取消删除请求',
    },
    listMine: {
      method: 'GET',
      path: '/comment/own/list',
      query: listMineQuery,
      responses: { 200: listMineResponse, ...standardReadErrors },
      summary: '登录用户查看自己的评论',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
