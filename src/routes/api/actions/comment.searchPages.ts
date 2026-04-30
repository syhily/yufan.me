import { searchPageOptions } from '@/server/comments/admin'
import { filterAutocompleteSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Server-side autocomplete for the comment moderation page-title
// filter. Replaces the old `getFilterOptions` GET that returned every
// page in one shot — that approach didn't scale and produced an empty
// "全部文章" sentinel row, see commit history.
export const loader = defineApiAction({
  method: 'GET',
  input: filterAutocompleteSchema,
  requireAdmin: true,
  async run({ payload }) {
    const pages = await searchPageOptions(payload.q, payload.limit)
    return { pages }
  },
})
