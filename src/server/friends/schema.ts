import { z } from 'zod'

import type { ListFriendsInput, UpsertFriendInput } from '@/shared/types/friends'

// Re-export the wire-format types alongside the Zod validators so
// admin Resource Routes import schema + type from the same module.
export type { ListFriendsInput, UpsertFriendInput }

// Helper: trim incoming text and treat the empty string as `undefined`
// so the optional Zod fields below don't coerce a blank input to a
// stored empty string.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value))

// `offset` / `limit` are coerced from query strings (the action is a
// GET and query params serialise numbers via `String(value)`).
// Hard upper bound on `limit` matches the tag list (100); the client
// only ever picks from {10, 20, 50, 100}.
export const listFriendsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  includeHidden: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional()
    .default(false),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const friendIdSchema = z.object({
  id: z.string().min(1),
})

export const upsertFriendSchema = z.object({
  // Optional — present means update, absent means create. Stringified
  // bigint matches the wire format used by the rest of the admin
  // surfaces (`AdminUserDto.id`, `AdminCommentDto.id`, …).
  id: z.string().min(1).optional(),
  website: z.string().trim().min(1).max(80),
  description: optionalText(999),
  homepage: z.url().max(500),
  poster: z.url().max(500),
  rssUrl: z
    .union([z.url().max(500), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value)),
  visible: z.boolean().optional().default(true),
})
