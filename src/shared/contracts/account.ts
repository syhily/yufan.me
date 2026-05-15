// /api/account/* — self-service account endpoints.
//
// Phase A1 spike: only `updateProfile` is migrated. The remaining
// account endpoints (`updatePassword`, `revokeSession`) land in
// Phase B1 once the contract template is validated.

import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { errorResponse } from '@/shared/contracts/_errors'
import { userDto } from '@/shared/contracts/_types'

// ─── Schemas ────────────────────────────────────────────

// Mirrors the existing handler at
// `src/routes/api/actions/account.updateProfile.ts`. Keeping the
// shape byte-identical lets the spike swap call sites one at a time
// without coordinating a wire-format change.
export const updateProfileBody = z.object({
  name: z.string().min(1).max(50).optional(),
  link: z.url().max(255).optional().nullable(),
  badgeName: z.string().max(20).optional().nullable(),
  badgeColor: z.string().max(7).optional().nullable(),
  badgeTextColor: z.string().max(7).optional().nullable(),
  receiveEmail: z.boolean().optional(),
})

export type UpdateProfileBody = z.infer<typeof updateProfileBody>

export const updateProfileResponse = z.object({
  user: userDto,
})

export type UpdateProfileResponse = z.infer<typeof updateProfileResponse>

// ─── Contract ──────────────────────────────────────────

export const accountContract = c.router(
  {
    updateProfile: {
      method: 'PATCH',
      path: '/account/profile',
      body: updateProfileBody,
      responses: {
        200: updateProfileResponse,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        413: errorResponse,
        429: errorResponse,
        500: errorResponse,
      },
      summary: '更新当前登录用户的资料（姓名、主页、徽章、订阅开关）',
    },
  },
  {
    strictStatusCodes: true,
  },
)
