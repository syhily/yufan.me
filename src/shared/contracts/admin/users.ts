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
    list: {
      method: 'GET',
      path: '/admin/users',
      query: listUsersQuery,
      responses: {
        200: z.object({ users: z.array(adminUserDto), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '管理后台：用户列表',
    },
    get: {
      method: 'GET',
      path: '/admin/users/:id',
      pathParams: idParam,
      responses: { 200: z.object({ user: adminUserDto }), ...standardReadErrors },
      summary: '管理后台：单个用户详情',
    },
    softDelete: {
      method: 'DELETE',
      path: '/admin/users/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：软删除用户',
    },
    restore: {
      method: 'POST',
      path: '/admin/users/:id/restore',
      pathParams: idParam,
      body: userIdBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：恢复用户',
    },
    mute: {
      method: 'PATCH',
      path: '/admin/users/:id/mute',
      pathParams: idParam,
      body: muteUserBody,
      responses: { 200: z.object({ user: adminUserDto }), ...standardMutationErrors },
      summary: '管理后台：禁言 / 解除禁言',
    },
    updateRole: {
      method: 'POST',
      path: '/admin/users/:id/role',
      pathParams: idParam,
      body: updateUserRoleBody,
      responses: { 200: z.object({ user: adminUserDto.nullable() }), ...standardMutationErrors },
      summary: '管理后台：更新用户角色',
    },
    inviteAuthor: {
      method: 'POST',
      path: '/admin/users/invite',
      body: inviteAuthorBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：邀请新作者',
    },
    sendPasswordReset: {
      method: 'POST',
      path: '/admin/users/password-reset',
      body: sendPasswordResetBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：发送密码重置邮件',
    },
    revokeSession: {
      method: 'POST',
      path: '/admin/users/revoke-session',
      body: revokeSessionBody,
      responses: { 200: z.object({ success: z.boolean(), currentSession: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：撤销指定会话',
    },
    revokeAllSessions: {
      method: 'POST',
      path: '/admin/users/revoke-all-sessions',
      body: userIdBody,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：撤销用户所有会话',
    },
    bulkApproveComments: {
      method: 'POST',
      path: '/admin/users/bulk-approve-comments',
      body: userIdBody,
      responses: { 200: z.object({ approved: z.number() }), ...standardMutationErrors },
      summary: '管理后台：批量通过用户评论',
    },
    bulkDeleteComments: {
      method: 'DELETE',
      path: '/admin/users/bulk-delete-comments',
      body: userIdBody,
      responses: { 200: z.object({ deleted: z.number() }), ...standardMutationErrors },
      summary: '管理后台：批量软删除用户评论',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
