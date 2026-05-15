import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

// ─── Schemas ────────────────────────────────────────────

const loadAllCommentsBody = z.object({
  offset: z.number().min(0),
  limit: z.number().min(1).max(100),
  pageKey: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['all', 'pending', 'approved']).optional(),
})

const filterAutocompleteQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  ids: z
    .string()
    .max(400)
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    ),
  key: z.string().max(2048).optional(),
})

// ─── DTO Schemas ─────────────────────────────────────────

const adminCommentDto = z.object({
  id: z.union([z.bigint(), z.number(), z.string()]),
  createAt: z.string(),
  body: z.unknown(),
  content: z.string().nullable(),
  type: z.string().nullable(),
  ownerId: z.union([z.bigint(), z.number()]).nullable(),
  userId: z.union([z.bigint(), z.number()]),
  name: z.string(),
  email: z.string(),
  link: z.string().nullable(),
  badgeName: z.string().nullable(),
  badgeColor: z.string().nullable(),
  badgeTextColor: z.string().nullable(),
  isPending: z.boolean().nullable(),
  isVerified: z.boolean().nullable(),
  isCollapsed: z.boolean().nullable(),
  isPinned: z.boolean().nullable(),
  voteUp: z.number().nullable(),
  voteDown: z.number().nullable(),
  rid: z.number(),
  rootId: z.union([z.bigint(), z.number()]).nullable(),
  pageTitle: z.string().nullable(),
  pagePublicId: z.string().nullable(),
})

const adminCommentsResultSchema = z.object({
  comments: z.array(adminCommentDto),
  total: z.number(),
  hasMore: z.boolean(),
  statusCounts: z.object({
    all: z.number(),
    pending: z.number(),
    approved: z.number(),
  }),
})

const commentRawBodySchema = z.object({
  id: z.string(),
  body: z.unknown(),
  content: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  pageTitle: z.string().nullable(),
  pagePublicId: z.string().nullable(),
})

const pageOptionSchema = z.object({
  key: z.string(),
  title: z.string(),
})

const authorOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// ─── Contract ──────────────────────────────────────────

export const adminCommentsContract = c.router(
  {
    approve: {
      method: 'PATCH',
      path: '/admin/comments/:id/approve',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：审核通过评论',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/comments/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：删除评论',
    },
    getRaw: {
      method: 'GET',
      path: '/admin/comments/:id/raw',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: commentRawBodySchema,
        ...standardReadErrors,
      },
      summary: '管理后台：获取评论原始内容',
    },
    loadAll: {
      method: 'POST',
      path: '/admin/comments/all',
      body: loadAllCommentsBody,
      responses: {
        200: adminCommentsResultSchema,
        ...standardMutationErrors,
      },
      summary: '管理后台：加载所有评论',
    },
    searchPages: {
      method: 'GET',
      path: '/admin/comments/search-pages',
      query: filterAutocompleteQuery,
      responses: {
        200: z.object({ options: z.array(pageOptionSchema) }),
        ...standardReadErrors,
      },
      summary: '管理后台：搜索页面标题自动补全',
    },
    searchAuthors: {
      method: 'GET',
      path: '/admin/comments/search-authors',
      query: filterAutocompleteQuery,
      responses: {
        200: z.object({ options: z.array(authorOptionSchema) }),
        ...standardReadErrors,
      },
      summary: '管理后台：搜索评论作者自动补全',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
