import { z } from 'zod'

import type { AdminImageDto, ListImagesOutput } from '@/shared/types/images'

import { idString, isoDateTime } from '@/shared/contracts/primitives'

export const adminImageDto = z.object({
  id: idString,
  kind: z.enum(['generic', 'category', 'friend']),
  storagePath: z.string(),
  publicUrl: z.string(),
  mimeType: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  byteSize: z.number().int().nonnegative(),
  thumbhash: z.string().nullable(),
  uploaderId: idString.nullable(),
  uploaderName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const listImagesOutputDto = z.object({
  images: z.array(adminImageDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

// ─── parity assertions ─────────────────────────────────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type _adminImageDtoParity = Assert<Equals<z.infer<typeof adminImageDto>, AdminImageDto>>
type _listImagesParity = Assert<Equals<z.infer<typeof listImagesOutputDto>, ListImagesOutput>>
