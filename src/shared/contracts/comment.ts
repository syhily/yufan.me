import { z } from 'zod'

import { c } from './_base'
import { standardMutationErrors, standardReadErrors } from './_errors'

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

// ─── Contract ──────────────────────────────────────────

export const commentContract = c.router(
  {
    loadComments: {
      method: 'GET',
      path: '/comment/comments',
      query: loadCommentsQuery,
      responses: {
        200: z.object({ comments: z.array(z.unknown()), next: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '加载评论列表',
    },

    replyComment: {
      method: 'POST',
      path: '/comment/comments',
      body: commentReplyBody,
      responses: {
        200: z.object({ comment: z.unknown(), csrfToken: z.string() }),
        ...standardMutationErrors,
      },
      summary: '提交新评论',
    },

    increaseLike: {
      method: 'POST',
      path: '/comment/likes',
      body: likeKeyBody,
      responses: {
        200: z.object({ key: z.string(), likes: z.number() }),
        ...standardMutationErrors,
      },
      summary: '点赞',
    },

    decreaseLike: {
      method: 'DELETE',
      path: '/comment/likes',
      body: likeDeleteBody,
      responses: {
        200: z.object({ key: z.string(), likes: z.number() }),
        ...standardMutationErrors,
      },
      summary: '取消点赞',
    },

    validateLikeToken: {
      method: 'POST',
      path: '/comment/likes/validate',
      body: likeValidateBody,
      responses: {
        200: z.object({ valid: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '验证点赞 token',
    },

    findAvatar: {
      method: 'POST',
      path: '/comment/avatar',
      body: findAvatarBody,
      responses: {
        200: z.object({ url: z.string().nullable() }),
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
        200: z.object({ comment: z.unknown() }),
        ...standardMutationErrors,
      },
      summary: '编辑评论（token / 登录用户）',
    },

    revokeToken: {
      method: 'POST',
      path: '/comment/tokens/revoke',
      body: revokeTokenBody,
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '撤销编辑 token',
    },
  },
  { strictStatusCodes: true },
)
