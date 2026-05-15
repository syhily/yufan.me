import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

export const adminCommentsContract = c.router(
  {
    approveCommentDeletion: {
      method: 'POST',
      path: '/admin/approve-comment-deletion',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'approveCommentDeletion',
    },
    listPendingDashboard: {
      method: 'GET',
      path: '/admin/list-pending-dashboard',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listPendingDashboard',
    },
  },
  { strictStatusCodes: true },
)
