import { searchAuthorOptions } from '@/server/comments/admin'
import { filterAutocompleteSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Server-side autocomplete for the comment moderation author filter.
// Bigint user ids are stringified at the wire boundary so the client
// never deals with `BigInt`. When the request includes `ids=…` we
// rehydrate a Combobox selection that was restored from the admin
// page URL (the URL only carries the id value, never the human label).
function parseBigIntIds(raw: string[] | undefined): bigint[] | undefined {
  if (!raw || raw.length === 0) return undefined
  const out: bigint[] = []
  for (const value of raw) {
    try {
      out.push(BigInt(value))
    } catch {
      // Silently drop malformed ids — a hostile/buggy caller doesn't
      // get to fail the whole request, just doesn't get a match for
      // the malformed value.
    }
  }
  return out.length > 0 ? out : undefined
}

export const loader = defineApiAction({
  method: 'GET',
  input: filterAutocompleteSchema,
  requireAdmin: true,
  async run({ payload }) {
    const ids = parseBigIntIds(payload.ids)
    const authors = await searchAuthorOptions(payload.q, payload.limit, ids)
    return {
      authors: authors.map((author) => ({ id: String(author.id), name: author.name })),
    }
  },
})
