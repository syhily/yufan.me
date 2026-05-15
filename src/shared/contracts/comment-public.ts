import { z } from 'zod'

import { commentBodySchema } from '@/shared/pt/comment-schema'
import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

import { c } from './_base'
import { commentItemDto } from './_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from './_errors'

const COMMENT_HONEYPOT_MAX_LEN = 240

const likeTokenResponse = z.object({
  key: z.string(),
  valid: z.boolean(),
})

const likeResponse = z.object({
  key: z.string(),
  likes: z.number().int().nonnegative(),
  token: z.string().optional(),
})

const decreaseLikeResponse = z.object({
  key: z.string(),
  likes: z.number().int().nonnegative(),
})

const avatarResponse = z.object({
  avatar: z.string(),
})

const commentReplyBody = z
  .object({
    page_key: z.string(),
    name: z.string(),
    email: z.email(),
    link: httpUrlOrEmptyStringSchema.optional(),
    body: commentBodySchema,
    csrf: z.string().min(1),
    rid: z.number().optional(),
    subtitle: z.string().max(COMMENT_HONEYPOT_MAX_LEN).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.subtitle.trim().length > 0) {
      ctx.addIssue({ code: 'custom', message: '输入数据无效。', path: ['subtitle'] })
    }
  })

const commentReplyResponse = z.object({
  comment: commentItemDto,
  csrfToken: z.string(),
})

const loadCommentsQuery = z.object({
  page_key: z.string(),
  offset: z.coerce.number(),
})

const loadCommentsResponse = z.object({
  comments: z.array(commentItemDto),
  next: z.boolean(),
})

const rawCommentResponse = z.object({
  body: commentBodySchema,
})

const editCommentBody = z.object({
  rid: z.string(),
  body: commentBodySchema,
})

const editCommentResponse = z.object({
  comment: commentItemDto,
})

export const commentPublicContract = c.router(
  {
    increaseLike: {
      method: 'POST',
      path: '/comment/likes',
      body: z.object({ key: z.string() }),
      responses: { 200: likeResponse, ...standardMutationErrors },
      summary: '增加点赞',
    },
    decreaseLike: {
      method: 'DELETE',
      path: '/comment/likes',
      body: z.object({ key: z.string(), token: z.string() }),
      responses: { 200: decreaseLikeResponse, ...standardMutationErrors },
      summary: '取消点赞',
    },
    validateLikeToken: {
      method: 'POST',
      path: '/comment/likes/validate',
      body: z.object({ key: z.string(), token: z.string() }),
      responses: { 200: likeTokenResponse, ...standardMutationErrors },
      summary: '验证点赞令牌',
    },
    findAvatar: {
      method: 'POST',
      path: '/comment/avatar',
      body: z.object({ email: z.email() }),
      responses: { 200: avatarResponse, ...standardMutationErrors },
      summary: '查找头像',
    },
    replyComment: {
      method: 'POST',
      path: '/comment/comments',
      body: commentReplyBody,
      responses: { 200: commentReplyResponse, ...standardMutationErrors },
      summary: '发表评论或回复',
    },
    loadComments: {
      method: 'GET',
      path: '/comment/comments',
      query: loadCommentsQuery,
      responses: { 200: loadCommentsResponse, ...standardReadErrors },
      summary: '加载评论列表',
    },
    getRaw: {
      method: 'GET',
      path: '/comment/comments/raw',
      query: z.object({ rid: z.string() }),
      responses: { 200: rawCommentResponse, ...standardReadErrors },
      summary: '获取评论原始内容',
    },
    edit: {
      method: 'PATCH',
      path: '/comment/comments/:rid',
      pathParams: z.object({ rid: z.string() }),
      body: editCommentBody.omit({ rid: true }),
      responses: { 200: editCommentResponse, ...standardMutationErrors },
      summary: '编辑评论内容',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
