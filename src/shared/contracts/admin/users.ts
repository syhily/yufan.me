import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminUserDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

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
      path: '/admin/users',
      query: listUsersQuery,
      responses: {
        200: z.object({ users: z.array(adminUserDto), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: 'listUsers',
    },
    getUser: {
      method: 'GET',
      path: '/admin/users/:id',
      pathParams: idParam,
      responses: { 200: z.object({ user: adminUserDto }), ...standardReadErrors },
      summary: 'getUser',
    },
    softDeleteUser: {
      method: 'DELETE',
      path: '/admin/users/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'softDeleteUser',
    },
    restoreUser: {
      method: 'POST',
      path: '/admin/users/:id/restore',
      pathParams: idParam,
      body: userIdBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'restoreUser',
    },
    muteUser: {
      method: 'PATCH',
      path: '/admin/users/:id/mute',
      pathParams: idParam,
      body: muteUserBody,
      responses: { 200: z.object({ user: adminUserDto }), ...standardMutationErrors },
      summary: 'muteUser',
    },
    updateUserRole: {
      method: 'POST',
      path: '/admin/users/:id/role',
      pathParams: idParam,
      body: updateUserRoleBody,
      responses: { 200: z.object({ user: adminUserDto.nullable() }), ...standardMutationErrors },
      summary: 'updateUserRole',
    },
    inviteAuthor: {
      method: 'POST',
      path: '/admin/users/invite',
      body: inviteAuthorBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'inviteAuthor',
    },
    sendPasswordReset: {
      method: 'POST',
      path: '/admin/users/password-reset',
      body: sendPasswordResetBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'sendPasswordReset',
    },
    revokeSession: {
      method: 'POST',
      path: '/admin/users/revoke-session',
      body: revokeSessionBody,
      responses: { 200: z.object({ success: z.boolean(), currentSession: z.boolean() }), ...standardMutationErrors },
      summary: 'revokeSession',
    },
    revokeUserSessions: {
      method: 'POST',
      path: '/admin/users/revoke-all-sessions',
      body: userIdBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'revokeUserSessions',
    },
    bulkApproveUserComments: {
      method: 'POST',
      path: '/admin/users/bulk-approve-comments',
      body: userIdBody,
      responses: { 200: z.object({ approved: z.number() }), ...standardMutationErrors },
      summary: 'bulkApproveUserComments',
    },
    bulkSoftDeleteUserComments: {
      method: 'DELETE',
      path: '/admin/users/bulk-delete-comments',
      body: userIdBody,
      responses: { 200: z.object({ deleted: z.number() }), ...standardMutationErrors },
      summary: 'bulkSoftDeleteUserComments',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
