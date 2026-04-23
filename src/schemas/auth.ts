import { z } from 'zod'

// Zod schemas shared between Astro Actions (server-side validation) and the
// frontend forms (client-side validation). Centralising them ensures the two
// can never silently drift in their min-length, regex, or required-field
// expectations.

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(10),
  token: z.string(),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpAdminSchema = z.object({
  name: z.string().min(1),
  email: z.email().min(1),
  password: z.string().min(10),
})
export type SignUpAdminInput = z.infer<typeof signUpAdminSchema>

export const signUpUserSchema = z.object({
  name: z.string().min(1),
  email: z.email().min(1),
  password: z.string().min(10),
  confirmPassword: z.string().min(10),
  token: z.string(),
})
export type SignUpUserInput = z.infer<typeof signUpUserSchema>

export const updateUserSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  link: z.string().optional(),
  badgeName: z.string().optional(),
  badgeColor: z.string().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>
