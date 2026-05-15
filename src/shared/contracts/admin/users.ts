import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })
const userIdBody = z.object({ userId: z.string().min(1) })

export const adminUsersContract = c.router(
  {
    listUsers: {
      method: 'GET',
      path: '/admin/list-users',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listUsers',
    },
    getUser: {
      method: 'POST',
      path: '/admin/get-user/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use userIdSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
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
      body: z.any() /* TODO: use userIdSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'restoreUser',
    },
    muteUser: {
      method: 'PATCH',
      path: '/admin/mute-user/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use muteUserSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'muteUser',
    },
    updateUserRole: {
      method: 'POST',
      path: '/admin/update-user-role/:id',
      pathParams: idParam,
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateUserRole',
    },
    inviteAuthor: {
      method: 'POST',
      path: '/admin/invite-author',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'inviteAuthor',
    },
    sendPasswordReset: {
      method: 'POST',
      path: '/admin/send-password-reset',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'sendPasswordReset',
    },
    revokeSession: {
      method: 'POST',
      path: '/admin/revoke-session',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'revokeSession',
    },
    revokeUserSessions: {
      method: 'POST',
      path: '/admin/revoke-user-sessions',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'revokeUserSessions',
    },
    bulkApproveUserComments: {
      method: 'POST',
      path: '/admin/bulk-approve-user-comments',
      body: z.any() /* TODO: use userIdSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'bulkApproveUserComments',
    },
    bulkSoftDeleteUserComments: {
      method: 'DELETE',
      path: '/admin/bulk-soft-delete-user-comments',
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'bulkSoftDeleteUserComments',
    },
  },
  { strictStatusCodes: true },
)
