import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

// ─── Schemas ────────────────────────────────────────────

const pendingDashboardQuery = z.object({
  kind: z.enum(['all', 'approval', 'deletion']).default('all'),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const bulkCommentBody = z.object({
  userId: z.string().min(1),
})

const approveDeletionBody = z.object({
  commentId: z.string().min(1),
})

// ─── DTO Schemas ─────────────────────────────────────────

const pendingItemDto = z.object({
  id: z.string(),
  kind: z.enum(['approval', 'deletion']),
  authorName: z.string(),
  authorLink: z.string().nullable(),
  excerpt: z.string(),
  createdAtIso: z.string(),
  deleteRequestedAtIso: z.string().nullable(),
  pageTitle: z.string().nullable(),
  pagePermalink: z.string().nullable(),
})

const pendingDashboardDto = z.object({
  items: z.array(pendingItemDto),
  total: z.number(),
  hasMore: z.boolean(),
  counts: z.object({
    all: z.number(),
    approval: z.number(),
    deletion: z.number(),
  }),
})

// ─── Contract ──────────────────────────────────────────

export const adminModerationContract = c.router(
  {
    bulkApproveComments: {
      method: 'POST',
      path: '/admin/comments/bulk-approve',
      body: bulkCommentBody,
      responses: {
        200: z.object({ approved: z.number() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：批量审核通过用户评论',
    },
    bulkSoftDeleteComments: {
      method: 'DELETE',
      path: '/admin/comments/bulk-delete',
      body: bulkCommentBody,
      responses: {
        200: z.object({ deleted: z.number() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：批量删除用户评论',
    },
    approveCommentDeletion: {
      method: 'POST',
      path: '/admin/comments/approve-deletion',
      body: approveDeletionBody,
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：批准评论删除请求',
    },
    listPendingDashboard: {
      method: 'GET',
      path: '/admin/dashboard/pending',
      query: pendingDashboardQuery,
      responses: {
        200: pendingDashboardDto,
        ...standardReadErrors,
      },
      summary: '管理后台：待处理事项（欢迎面板）',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
