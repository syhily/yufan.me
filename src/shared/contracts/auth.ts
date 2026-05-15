import { z } from 'zod'

import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

import { c } from './_base'
import { errorResponse, standardMutationErrors } from './_errors'

export const updateUserBody = z
  .object({
    userId: z.string(),
    name: z.string().min(1).optional(),
    email: z.string().pipe(z.email()).optional(),
    link: httpUrlOrEmptyStringSchema.optional(),
    badgeName: z.string().optional(),
    badgeColor: z.string().optional(),
    badgeTextColor: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => (value === undefined ? undefined : value && value.trim() !== '' ? value : null)),
  })
  .refine(({ userId: _userId, ...patch }) => Object.values(patch).some((value) => value !== undefined), {
    message: '至少需要提供一个更新字段',
  })

export const authContract = c.router(
  {
    updateUser: {
      method: 'PATCH',
      path: '/auth/users',
      body: updateUserBody,
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理员更新指定用户资料',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
