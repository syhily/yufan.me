import { z } from 'zod'

import { c } from './_base'
import { standardMutationErrors } from './_errors'
import { clientUserDto } from './_types'

// ─── Schemas ────────────────────────────────────────────

export const updateProfileBody = z.object({
  name: z.string().min(1).max(50).optional(),
  link: z.string().max(255).pipe(z.url()).optional().nullable(),
  badgeName: z.string().max(20).optional().nullable(),
  badgeColor: z.string().max(7).optional().nullable(),
  badgeTextColor: z.string().max(7).optional().nullable(),
  receiveEmail: z.boolean().optional(),
})

export const updatePasswordBody = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export const revokeSessionBody = z.object({
  sessionId: z.string().min(1),
})

export const revokeSessionResponse = z.object({
  success: z.boolean(),
  currentSession: z.boolean(),
})

export const updateProfileResponse = z.object({ user: clientUserDto })
export const updatePasswordResponse = z.object({ success: z.boolean() })

// ─── Contract ──────────────────────────────────────────

export const accountContract = c.router(
  {
    updateProfile: {
      method: 'PATCH',
      path: '/account/profile',
      body: updateProfileBody,
      responses: {
        200: updateProfileResponse,
        ...standardMutationErrors,
      },
      summary: '更新当前用户资料',
    },

    updatePassword: {
      method: 'POST',
      path: '/account/password',
      body: updatePasswordBody,
      responses: {
        200: updatePasswordResponse,
        ...standardMutationErrors,
      },
      summary: '更新当前用户密码',
    },

    revokeSession: {
      method: 'POST',
      path: '/account/sessions/revoke',
      body: revokeSessionBody,
      responses: {
        200: revokeSessionResponse,
        ...standardMutationErrors,
      },
      summary: '撤销指定会话',
    },
  },
  {
    strictStatusCodes: true,
  },
)
