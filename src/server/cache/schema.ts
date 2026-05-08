import { z } from 'zod'

import type { ClearCacheInput } from '@/shared/cache-types'

import { CACHE_BUCKET_IDS } from '@/shared/cache-types'

// `'all'` is a separate explicit option (rather than e.g. an empty array
// or omitted field) so the UI's two distinct buttons map to two distinct
// payloads on the wire — easier to log, easier to test.
//
// The bucket ID list is fixed at the source-code level — admin
// settings can rename a bucket's PREFIX, not change the ID list — so
// the static `CACHE_BUCKET_IDS` tuple stays correct for the lifetime
// of the process.
export const clearCacheSchema = z.object({
  target: z.union([z.enum(CACHE_BUCKET_IDS), z.literal('all')]),
})

export type { ClearCacheInput }
