import { z } from 'zod'

export const clientUserDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().pipe(z.email()),
  website: z.string().nullable(),
  role: z.enum(['visitor', 'author', 'admin']),
  badgeName: z.string().nullable().optional(),
  badgeColor: z.string().nullable().optional(),
  badgeTextColor: z.string().nullable().optional(),
  receiveEmail: z.boolean().nullable().optional(),
})

export type ClientUserDto = z.infer<typeof clientUserDto>

// Used by admin controllers
export const adminUserDto = clientUserDto.extend({
  createdAt: z.union([z.string(), z.date()]).optional(),
  lastLoginAt: z.union([z.string(), z.date()]).nullable().optional(),
  lastActiveAt: z.union([z.string(), z.date()]).nullable().optional(),
  deletedAt: z.union([z.string(), z.date()]).nullable().optional(),
})

export type AdminUserDto = z.infer<typeof adminUserDto>
