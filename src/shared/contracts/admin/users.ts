import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'

export const listUsersQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  role: z.enum(['all', 'admin', 'normal']).default('all'),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['recent', 'commentCount']).default('recent'),
  hasPosts: z.coerce.boolean().optional(),
})

const adminUserDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  link: z.string().nullable(),
  badgeName: z.string().nullable(),
  badgeColor: z.string().nullable(),
  badgeTextColor: z.string().nullable(),
  role: z.enum(['admin', 'author', 'visitor']).nullable(),
  isMuted: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  lastIp: z.string().nullable(),
  lastUa: z.string().nullable(),
  commentCount: z.number(),
  pendingCount: z.number(),
  lastCommentAt: z.string().nullable(),
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
      pathParams: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ user: adminUserDto }), ...standardReadErrors },
      summary: '管理后台：用户详情',
    },
    mute: {
      method: 'PATCH',
      path: '/admin/users/:id/mute',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({ muted: z.boolean() }),
      responses: { 200: z.object({ user: adminUserDto }), ...standardMutationErrors },
      summary: '管理后台：禁言 / 解除禁言',
    },
    updateRole: {
      method: 'PATCH',
      path: '/admin/users/:id/role',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({ role: z.enum(['admin', 'author', 'visitor']) }),
      responses: { 200: z.object({ user: adminUserDto }), ...standardMutationErrors },
      summary: '管理后台：更新用户角色',
    },
    softDelete: {
      method: 'DELETE',
      path: '/admin/users/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：软删除用户',
    },
    restore: {
      method: 'POST',
      path: '/admin/users/:id/restore',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：恢复已删除用户',
    },
    revokeSession: {
      method: 'POST',
      path: '/admin/users/:id/sessions/revoke',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({ sessionId: z.string().min(1) }),
      responses: { 200: z.object({ success: z.boolean(), currentSession: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：撤销指定会话',
    },
    revokeAllSessions: {
      method: 'POST',
      path: '/admin/users/:id/sessions/revoke-all',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：撤销用户所有会话',
    },
    inviteAuthor: {
      method: 'POST',
      path: '/admin/users/invite',
      body: z.object({
        name: z.string().min(1).max(100),
        email: z.email(),
      }),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：邀请新作者',
    },
    sendPasswordReset: {
      method: 'POST',
      path: '/admin/users/password-reset',
      body: z.object({
        userId: z.string().min(1),
      }),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：发送密码重置邮件',
    },
  },
  { strictStatusCodes: true },
)
