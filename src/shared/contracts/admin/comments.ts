import { z } from 'zod'

import type { AdminPendingDashboardDto } from '@/shared/comments'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

export const adminCommentsContract = c.router(
  {
    approveCommentDeletion: {
      method: 'POST',
      path: '/admin/approve-comment-deletion',
      body: z.object({ commentId: z.string(), approve: z.boolean() }),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'approveCommentDeletion',
    },
    listPendingDashboard: {
      method: 'GET',
      path: '/admin/list-pending-dashboard',
      query: z.object({ kind: z.string().optional(), offset: z.number().optional(), limit: z.number().optional() }),
      responses: { 200: z.custom<AdminPendingDashboardDto>(), ...standardMutationErrors },
      summary: 'listPendingDashboard',
    },
  },
  { strictStatusCodes: true },
)
