import { z } from 'zod'

import { commentBodySchema } from '@/shared/pt/comment-schema'
import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

import { c } from './_base'
import { standardMutationErrors, standardReadErrors } from './_errors'

const COMMENT_HONEYPOT_MAX_LEN = 240

// ─── Schemas ────────────────────────────────────────────

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
    email: z.string().email(),
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
  comment: z.any(),
  csrfToken: z.string(),
})

const loadCommentsQuery = z.object({
  page_key: z.string(),
  offset: z.coerce.number(),
})

const loadCommentsResponse = z.object({
  comments: z.array(z.any()),
  next: z.boolean(),
})

const myCommentsQuery = z.object({
  page_key: z.string(),
})

const myCommentsResponse = z.object({
  comments: z.array(z.any()),
  expiresAt: z.record(z.string(), z.number()),
})

const loadAllBody = z.object({
  offset: z.number().min(0),
  limit: z.number().min(1).max(100),
  pageKey: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['all', 'pending', 'approved']).optional(),
})

const loadAllResponse = z.object({
  comments: z.array(z.any()),
  total: z.number().int(),
  hasMore: z.boolean(),
  statusCounts: z.object({
    all: z.number().int(),
    pending: z.number().int(),
    approved: z.number().int(),
  }),
})

const filterAutocompleteQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  ids: z.string().max(400).optional(),
  key: z.string().max(2048).optional(),
})

const searchPagesResponse = z.object({
  pages: z.array(z.any()),
})

const searchAuthorsResponse = z.object({
  authors: z.array(z.object({ id: z.string(), name: z.string() })),
})

const listMineQuery = z.object({
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(20),
})

const listMineResponse = z.object({
  comments: z.array(z.any()),
  total: z.number().int(),
  pending: z.number().int(),
  deleteRequested: z.number().int(),
  hasMore: z.boolean(),
})

const rawCommentResponse = z.object({
  body: z.any(),
})

const editCommentBody = z.object({
  rid: z.string(),
  body: commentBodySchema,
})

const editCommentResponse = z.object({
  comment: z.any(),
})

const successResponse = z.object({ success: z.boolean() })

// ─── Contract ──────────────────────────────────────────

export const commentContract = c.router(
  {
    // Likes (public)
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

    // Avatar (public)
    findAvatar: {
      method: 'POST',
      path: '/comment/avatar',
      body: z.object({ email: z.string().email() }),
      responses: { 200: avatarResponse, ...standardMutationErrors },
      summary: '查找头像',
    },

    // Comments (public)
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

    // Token management (public)
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

    // Self-service (visitor)
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

    // Admin moderation
    approve: {
      method: 'PATCH',
      path: '/comment/comments/:rid/approve',
      pathParams: z.object({ rid: z.string() }),
      body: c.noBody(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: '管理员审核通过评论',
    },
    delete: {
      method: 'DELETE',
      path: '/comment/comments/:rid',
      pathParams: z.object({ rid: z.string() }),
      body: c.noBody(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: '管理员删除评论',
    },
    edit: {
      method: 'PATCH',
      path: '/comment/comments/:rid',
      pathParams: z.object({ rid: z.string() }),
      body: editCommentBody.omit({ rid: true }),
      responses: { 200: editCommentResponse, ...standardMutationErrors },
      summary: '编辑评论内容',
    },

    // Admin listing & search
    loadAll: {
      method: 'POST',
      path: '/comment/all',
      body: loadAllBody,
      responses: { 200: loadAllResponse, ...standardMutationErrors },
      summary: '管理员加载所有评论',
    },
    searchPages: {
      method: 'GET',
      path: '/comment/search/pages',
      query: filterAutocompleteQuery,
      responses: { 200: searchPagesResponse, ...standardReadErrors },
      summary: '搜索页面',
    },
    searchAuthors: {
      method: 'GET',
      path: '/comment/search/authors',
      query: filterAutocompleteQuery,
      responses: { 200: searchAuthorsResponse, ...standardReadErrors },
      summary: '搜索作者',
    },
  },
  { strictStatusCodes: true },
)
