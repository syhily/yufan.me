import { z } from 'zod'

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
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminFriendDtoParity = Assert<Equals<z.infer<typeof adminFriendDto>, AdminFriendDto>>
