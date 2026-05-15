import { z } from 'zod'

import { c } from './_base'
import { errorResponse, standardMutationErrors } from './_errors'

// ─── Schemas ────────────────────────────────────────────

export const updateProfileBody = z.object({
  name: z.string().min(1).max(50).optional(),
  link: z.url().max(255).optional().nullable(),
  badgeName: z.string().max(20).optional().nullable(),
  badgeColor: z.string().max(7).optional().nullable(),
  badgeTextColor: z.string().max(7).optional().nullable(),
  receiveEmail: z.boolean().optional(),
})

export const updatePasswordBody = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export const revokeSessionPathParams = z.object({
  id: z.string().min(1),
})

// ─── Contract ──────────────────────────────────────────

export const accountContract = c.router(
  {
    updateProfile: {
      method: 'PATCH',
      path: '/account/profile',
      body: updateProfileBody,
      responses: {
        200: z.object({ user: z.unknown() }),
        ...standardMutationErrors,
      },
      summary: '更新当前用户资料',
    },

    updatePassword: {
      method: 'PATCH',
      path: '/account/password',
      body: updatePasswordBody,
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '修改当前用户密码',
    },

    revokeSession: {
      method: 'DELETE',
      path: '/account/sessions/:id',
      pathParams: revokeSessionPathParams,
      responses: {
        200: z.object({ success: z.boolean(), currentSession: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '撤销指定会话',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
