import { z } from 'zod'

import type { AdminComment, AdminPendingDashboardDto } from '@/shared/comments'

import { c } from './_base'
import { standardMutationErrors, standardReadErrors } from './_errors'

const loadAllBody = z.object({
  offset: z.number().min(0),
  limit: z.number().min(1).max(100),
  pageKey: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['all', 'pending', 'approved']).optional(),
})

const loadAllResponse = z.object({
  comments: z.array(z.custom<AdminComment>()),
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
  pages: z.array(z.object({ key: z.string(), title: z.string().nullable() })),
})

const searchAuthorsResponse = z.object({
  authors: z.array(z.object({ id: z.string(), name: z.string() })),
})

export const commentAdminContract = c.router(
  {
    approve: {
      method: 'PATCH',
      path: '/comment/comments/:rid/approve',
      pathParams: z.object({ rid: z.string() }),
      body: c.noBody(),
      responses: { 204: z.null(), ...standardMutationErrors },
      summary: '管理员审核通过评论',
    },
    delete: {
      method: 'DELETE',
      path: '/comment/comments/:rid',
      pathParams: z.object({ rid: z.string() }),
      body: c.noBody(),
      responses: { 204: z.null(), ...standardMutationErrors },
      summary: '管理员删除评论',
    },
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
    approveCommentDeletion: {
      method: 'POST',
      path: '/admin/comments/approve-deletion',
      body: z.object({ commentId: z.string(), approve: z.boolean() }),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'approveCommentDeletion',
    },
    listPendingDashboard: {
      method: 'GET',
      path: '/admin/comments/pending-dashboard',
      query: z.object({ kind: z.string().optional(), offset: z.number().optional(), limit: z.number().optional() }),
      responses: { 200: z.custom<AdminPendingDashboardDto>(), ...standardMutationErrors },
      summary: 'listPendingDashboard',
    },
  },
  { strictStatusCodes: true },
)
