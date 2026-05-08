import { z } from 'zod'

import type { AdminTagDto } from '@/shared/types/tags'

import { idString, isoDateTime } from '@/shared/contracts/index'

export const adminTagDto = z.object({
  id: idString,
  name: z.string(),
  slug: z.string(),
  postCount: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

// ─── parity assertion ──────────────────────────────────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminTagDtoParity = Assert<Equals<z.infer<typeof adminTagDto>, AdminTagDto>>
