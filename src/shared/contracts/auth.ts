import { z } from 'zod'

import { c } from './_base'
import { standardMutationErrors } from './_errors'

export const updateUserBody = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  link: z.string().optional(),
  badgeName: z.string().optional(),
  badgeColor: z.string().optional(),
  badgeTextColor: z.union([z.string(), z.null()]).optional(),
})

export const authContract = c.router(
  {
    updateUser: {
      method: 'PATCH',
      path: '/auth/users/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: updateUserBody,
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理员更新用户信息',
    },
  },
  {
    strictStatusCodes: true,
  },
)
