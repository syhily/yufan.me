import { z } from 'zod'

import type { AdminPendingDashboardDto } from '@/shared/types/comments'

import { idString, isoDateTime } from '@/shared/contracts/index'

export const adminPendingDashboardDto = z.object({
  items: z.array(
    z.object({
      id: idString,
      kind: z.enum(['approval', 'deletion']),
      authorName: z.string(),
      authorLink: z.string().nullable(),
      excerpt: z.string(),
      createdAtIso: isoDateTime,
      deleteRequestedAtIso: isoDateTime.nullable(),
      pageTitle: z.string().nullable(),
      pagePermalink: z.string().nullable(),
    }),
  ),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  counts: z.object({
    all: z.number().int().nonnegative(),
    approval: z.number().int().nonnegative(),
    deletion: z.number().int().nonnegative(),
  }),
})

// ─── parity assertion ──────────────────────────────────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminPendingDashboardParity = Assert<Equals<z.infer<typeof adminPendingDashboardDto>, AdminPendingDashboardDto>>
