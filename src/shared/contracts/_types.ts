// Cross-contract DTO schemas — pure isomorphic Zod, no Node deps.
// Each contract file pulls only what it needs from here so the
// client bundle doesn't ship admin DTOs to the public site.

import { z } from 'zod'

// Public-facing user shape returned from /api/account/* endpoints.
// `bigint` ids are serialised to strings on the wire.
export const userDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  link: z.string(),
  role: z.enum(['admin', 'author', 'visitor']).nullable(),
  badgeName: z.string(),
  badgeColor: z.string(),
  badgeTextColor: z.string().nullable(),
  receiveEmail: z.boolean(),
})

export type UserDto = z.infer<typeof userDto>

// Viewer context echoed on session-tied endpoints (Phase B+).
// Not used by /api/account/profile but co-located so future
// contracts (auth.session, comment.viewer) share the shape.
export const viewerDto = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'author', 'visitor']),
})

export type ViewerDto = z.infer<typeof viewerDto>
