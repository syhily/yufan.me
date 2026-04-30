import { z } from 'zod'

import { isSupportedTimeZone } from '@/server/settings/timezones'
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

// First-run install — STAGE 2 only. The site / asset / localization
// fields the DB-backed snapshot needs before any public route can
// render. Stage 1 (admin credentials) reuses `signUpAdminSchema`
// above. Other admin settings sections (navigation, sidebar, mail, …)
// are deliberately left blank — there are no defaults anywhere in the
// codebase, so the editor visits the relevant `/wp-admin/settings/*`
// page and fills them in explicitly.
export const installSettingsSchema = z.object({
  token: z.string().default(''),
  // Site
  title: z.string().trim().min(1).max(120),
  website: z.url(),
  authorEmail: z.email(),
  // Asset (mirrors `localizationSchema.asset`)
  assetHost: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-z0-9.-]+$/i, '只能包含字母 / 数字 / `-` / `.`'),
  assetScheme: z.enum(['http', 'https']),
  // Localization
  locale: z.string().trim().min(2).max(35),
  // Same defence-in-depth as `localizationSchema`: the install dropdown
  // already restricts the choices to `Intl.supportedValuesOf`, but a
  // direct POST against this action must not be able to seed an
  // unsupported zone that would later crash every formatter call.
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isSupportedTimeZone, { message: '必须是 IANA 时区名（如 Asia/Shanghai、UTC）' }),
  timeFormat: z.string().trim().min(1).max(40),
})
export type InstallSettingsInput = z.infer<typeof installSettingsSchema>

export const updateUserSchema = z
  .object({
    userId: z.string(),
    name: z.string().min(1).optional(),
    email: z.email().optional(),
    link: httpUrlOrEmptyStringSchema.optional(),
    badgeName: z.string().optional(),
    badgeColor: z.string().optional(),
    // Optional manual override for the badge text colour. The form
    // sends a string (the picker output), an explicit `null` ("clear
    // override"), or `undefined` ("don't touch"). We normalise empty
    // strings to `null` here so the storage column has just two
    // meaningful states: explicit hex, or NULL → auto-derive.
    badgeTextColor: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => (value === undefined ? undefined : value && value.trim() !== '' ? value : null)),
  })
  .refine(({ userId: _userId, ...patch }) => Object.values(patch).some((value) => value !== undefined), {
    message: '至少需要提供一个更新字段',
  })
export type UpdateUserInput = z.infer<typeof updateUserSchema>
