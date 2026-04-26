import { z } from 'zod'

import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(10),
  token: z.string().default(''),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpAdminSchema = z.object({
  name: z.string().min(1),
  email: z.email().min(1),
  password: z.string().min(10),
  token: z.string().default(''),
})
export type SignUpAdminInput = z.infer<typeof signUpAdminSchema>

export const updateUserSchema = z
  .object({
    userId: z.string(),
    name: z.string().min(1).optional(),
    email: z.email().optional(),
    link: httpUrlOrEmptyStringSchema.optional(),
    badgeName: z.string().optional(),
    badgeColor: z.string().optional(),
  })
  .refine(({ userId: _userId, ...patch }) => Object.values(patch).some((value) => value !== undefined), {
    message: '至少需要提供一个更新字段',
  })
export type UpdateUserInput = z.infer<typeof updateUserSchema>
