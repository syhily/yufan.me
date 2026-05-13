import { searchPageOptions } from '@/server/comments/admin'
import { filterAutocompleteSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Server-side autocomplete for the comment moderation page-title
// filter. Replaces the old `getFilterOptions` GET that returned every
// page in one shot — that approach didn't scale and produced an empty
// "全部文章" sentinel row, see commit history.
//
// When `key` is supplied we treat it as a single page `key` to
// rehydrate from a `?pageKey=…` URL parameter (the URL only carries
// the key, never the human title, so the client needs a one-shot
// lookup to render the real title in the Combobox trigger).
export const loader = defineApiAction({
  method: 'GET',
  input: filterAutocompleteSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const keys = payload.key ? [payload.key] : undefined
    const pages = await searchPageOptions(payload.q, payload.limit, keys)
    return { pages }
  },
})
