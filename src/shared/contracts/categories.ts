import { z } from 'zod'

import type { AdminCategoryDto } from '@/shared/types/categories'

import { idString, isoDateTime } from '@/shared/contracts/index'

export const adminCategoryDto = z.object({
  id: idString,
  name: z.string(),
  slug: z.string(),
  cover: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  postCount: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

// ─── parity assertion ──────────────────────────────────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminCategoryDtoParity = Assert<Equals<z.infer<typeof adminCategoryDto>, AdminCategoryDto>>
