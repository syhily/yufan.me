import { z } from 'zod'

import { buildPermalinkSet } from '@/server/posts/query'

// Reusable Zod fragment that validates a comment's `key` (permalink) against
// the live catalog. Extracted so the half-dozen comment-related resource
// routes don't each re-define it.
export const permalinkKeySchema = z.string().refine(
  async (value) => {
    const set = await buildPermalinkSet()
    return set.has(value)
  },
  { message: 'Unknown comment key' },
)
