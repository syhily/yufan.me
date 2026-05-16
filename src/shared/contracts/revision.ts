import { z } from 'zod'

import type { AdminRevisionDto } from '@/shared/types/posts'

import { idString, isoDateTime } from '@/shared/contracts/primitives'
import { markdownHeadingDto } from '@/shared/contracts/primitives'
import { portableTextBodySchema } from '@/shared/pt/schema'

export const adminRevisionDto = z.object({
  id: idString,
  revisionNo: z.number().int().nonnegative(),
  status: z.enum(['draft', 'published']),
  body: portableTextBodySchema,
  imageSources: z.array(z.string()),
  headings: z.array(markdownHeadingDto),
  authorId: idString.nullable(),
  clientRevisionToken: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

// ─── parity helpers ────────────────────────────────────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminRevisionDtoParity = Assert<Equals<z.infer<typeof adminRevisionDto>, AdminRevisionDto>>
