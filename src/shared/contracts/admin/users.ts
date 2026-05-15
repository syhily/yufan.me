import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

const listUsersQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  role: z.enum(['all', 'admin', 'author', 'visitor', 'normal']).default('all'),
  includeDeleted: z.coerce.boolean().default(false),
  hasPosts: z.coerce.boolean().default(false),
  sortBy: z.enum(['recent', 'commentCount']).default('recent'),
})

const muteUserBody = z.object({
  muted: z.boolean(),
})

const updateUserRoleBody = z.object({
  role: z.enum(['admin', 'author', 'visitor']).nullable(),
})

const inviteAuthorBody = z.object({
  email: z.email().min(1),
  name: z.string().min(1).max(100),
})

const sendPasswordResetBody = z.object({
  email: z.email().min(1),
})

const revokeSessionBody = z.object({
  sessionId: z.string().min(1),
})

const userIdBody = z.object({
  userId: z.string().min(1),
})

export const adminUsersContract = c.router(
  {
    listUsers: {
      method: 'GET',
      path: '/admin/list-users',
      query: listUsersQuery,
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'listUsers',
    },
    getUser: {
      method: 'GET',
      path: '/admin/get-user/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'getUser',
    },
    softDeleteUser: {
      method: 'DELETE',
      path: '/admin/soft-delete-user/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'softDeleteUser',
    },
    restoreUser: {
      method: 'POST',
      path: '/admin/restore-user/:id',
      pathParams: idParam,
      body: userIdBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'restoreUser',
    },
    muteUser: {
      method: 'PATCH',
      path: '/admin/mute-user/:id',
      pathParams: idParam,
      body: muteUserBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'muteUser',
    },
    updateUserRole: {
      method: 'POST',
      path: '/admin/update-user-role/:id',
      pathParams: idParam,
      body: updateUserRoleBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateUserRole',
    },
    inviteAuthor: {
      method: 'POST',
      path: '/admin/invite-author',
      body: inviteAuthorBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'inviteAuthor',
    },
    sendPasswordReset: {
      method: 'POST',
      path: '/admin/send-password-reset',
      body: sendPasswordResetBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'sendPasswordReset',
    },
    revokeSession: {
      method: 'POST',
      path: '/admin/revoke-session',
      body: revokeSessionBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'revokeSession',
    },
    revokeUserSessions: {
      method: 'POST',
      path: '/admin/revoke-user-sessions',
      body: userIdBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'revokeUserSessions',
    },
    bulkApproveUserComments: {
      method: 'POST',
      path: '/admin/bulk-approve-user-comments',
      body: userIdBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'bulkApproveUserComments',
    },
    bulkSoftDeleteUserComments: {
      method: 'DELETE',
      path: '/admin/bulk-soft-delete-user-comments',
      body: userIdBody,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'bulkSoftDeleteUserComments',
    },
  },
  { strictStatusCodes: true },
)
