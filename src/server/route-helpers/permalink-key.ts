import { z } from 'zod'

import { getCatalog } from '@/server/catalog'

// Reusable Zod fragment that validates a comment's `key` (permalink) against
// the live catalog. Extracted so the half-dozen comment-related resource
// routes don't each re-define it.
export const permalinkKeySchema = z.string().refine(async (value) => (await getCatalog()).permalinks.has(value), {
  message: 'Unknown comment key',
})
