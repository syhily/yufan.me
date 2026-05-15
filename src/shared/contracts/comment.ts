import { z } from 'zod'

import { c } from './_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from './_errors'

// ─── Schemas ────────────────────────────────────────────

export const loadCommentsQuery = z.object({
  page_key: z.string(),
  offset: z.coerce.number(),
})

export const commentReplyBody = z.object({
  page_key: z.string(),
  name: z.string(),
  email: z.string().pipe(z.email()),
  link: z.string().max(255).optional(),
  body: z.unknown(), // PortableText
  csrf: z.string().min(1),
  rid: z.number().optional(),
  subtitle: z.string().max(240).optional().default(''),
})

export const likeKeyBody = z.object({ key: z.string().min(1) })
export const likeDeleteBody = z.object({ key: z.string().min(1), token: z.string().min(1) })
export const likeValidateBody = z.object({ key: z.string().min(1), token: z.string().min(1) })
export const findAvatarBody = z.object({ email: z.string().min(1) })

export const commentRidBody = z.object({ rid: z.string() })
export const commentEditBody = z.object({ rid: z.string(), body: z.unknown() })

export const revokeTokenBody = z.object({ pageKey: z.string().min(1) })

export const loadCommentsResponse = z.object({ comments: z.array(z.unknown()), next: z.boolean() })
export const replyCommentResponse = z.object({ comment: z.unknown(), csrfToken: z.string() })
export const increaseLikeResponse = z.object({ key: z.string(), likes: z.number(), token: z.string() })
export const decreaseLikeResponse = z.object({ key: z.string(), likes: z.number() })
export const validateLikeTokenResponse = z.object({ key: z.string(), valid: z.boolean() })
export const findAvatarResponse = z.object({ url: z.string().nullable() })
export const editCommentResponse = z.object({ comment: z.unknown() })
export const revokeTokenResponse = z.object({ success: z.boolean() })
export const updateOwnCommentResponse = z.object({ comment: z.unknown() })
export const requestDeleteOwnCommentResponse = z.object({ success: z.boolean() })
export const cancelDeleteOwnCommentResponse = z.object({ success: z.boolean() })
export const listMineCommentsResponse = z.object({ comments: z.array(z.unknown()), total: z.number() })

// ─── Contract ──────────────────────────────────────────

export const commentContract = c.router(
  {
    loadComments: {
      method: 'GET',
      path: '/comment/comments',
      query: loadCommentsQuery,
      responses: {
        200: loadCommentsResponse,
        ...standardReadErrors,
      },
      summary: '加载评论列表',
    },

    replyComment: {
      method: 'POST',
      path: '/comment/comments',
      body: commentReplyBody,
      responses: {
        200: replyCommentResponse,
        ...standardMutationErrors,
      },
      summary: '提交新评论',
    },

    increaseLike: {
      method: 'POST',
      path: '/comment/likes',
      body: likeKeyBody,
      responses: {
        200: increaseLikeResponse,
        ...standardMutationErrors,
      },
      summary: '点赞',
    },

    decreaseLike: {
      method: 'DELETE',
      path: '/comment/likes',
      body: likeDeleteBody,
      responses: {
        200: decreaseLikeResponse,
        ...standardMutationErrors,
      },
      summary: '取消点赞',
    },

    validateLikeToken: {
      method: 'POST',
      path: '/comment/likes/validate',
      body: likeValidateBody,
      responses: {
        200: validateLikeTokenResponse,
        ...standardMutationErrors,
      },
      summary: '验证点赞 token',
    },

    findAvatar: {
      method: 'POST',
      path: '/comment/avatar',
      body: findAvatarBody,
      responses: {
        200: findAvatarResponse,
        ...standardReadErrors,
      },
      summary: '根据邮箱查找头像',
    },

    edit: {
      method: 'PATCH',
      path: '/comment/comments/:rid',
      pathParams: commentRidBody,
      body: commentEditBody,
      responses: {
        200: editCommentResponse,
        ...standardMutationErrors,
      },
      summary: '编辑评论（token / 登录用户）',
    },

    revokeToken: {
      method: 'POST',
      path: '/comment/tokens/revoke',
      body: revokeTokenBody,
      responses: {
        200: revokeTokenResponse,
        ...standardMutationErrors,
      },
      summary: '撤销编辑 token',
    },

    updateOwn: {
      method: 'POST',
      path: '/comment/own',
      body: z.object({ rid: z.string(), body: z.unknown() }),
      responses: { 200: updateOwnCommentResponse, ...standardMutationErrors },
      summary: '用户编辑自己的评论',
    },

    requestDeleteOwn: {
      method: 'POST',
      path: '/comment/own/delete',
      body: z.object({ rid: z.string() }),
      responses: { 200: requestDeleteOwnCommentResponse, ...standardMutationErrors },
      summary: '用户请求删除自己的评论',
    },

    cancelDeleteOwn: {
      method: 'DELETE',
      path: '/comment/own/delete',
      body: z.object({ rid: z.string() }),
      responses: { 200: cancelDeleteOwnCommentResponse, ...standardMutationErrors },
      summary: '用户取消评论删除请求',
    },

    listMine: {
      method: 'GET',
      path: '/comment/my',
      query: z.object({ offset: z.coerce.number().optional(), limit: z.coerce.number().optional() }),
      responses: { 200: listMineCommentsResponse, ...standardReadErrors },
      summary: '用户自己的评论列表',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
