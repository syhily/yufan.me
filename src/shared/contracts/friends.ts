import { z } from 'zod'

import type { Assert, Equals } from '@/shared/contracts/primitives'
import type { AdminFriendDto } from '@/shared/types/friends'

import { idString, isoDateTime } from '@/shared/contracts/primitives'

export const adminFriendDto = z.object({
  id: idString,
  website: z.string(),
  description: z.string().nullable(),
  homepage: z.string(),
  poster: z.string(),
  rssUrl: z.string().nullable(),
  visible: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

// ─── parity assertion ──────────────────────────────────
type _adminFriendDtoParity = Assert<Equals<z.infer<typeof adminFriendDto>, AdminFriendDto>>
