import { createTokenizer } from '@orama/tokenizers/mandarin'
import { type AdvancedIndex, initAdvancedSearch } from 'fumadocs-core/search/server'

import type { PostVisibilityOptions } from '@/server/catalog'

import { ContentCatalog } from '@/server/catalog'

// Search should only index posts that can also be rendered by the route.
// Hidden posts are intentionally searchable; scheduled posts stay dev-only for
// authoring checks and are excluded from production search results.
export function searchPostOptions(): PostVisibilityOptions {
  return { includeHidden: true, includeScheduled: import.meta.env.DEV }
}

// Lazily build the Orama-backed fumadocs search server on first query and
// cache the resulting Promise so concurrent requests share one build.
let serverPromise: Promise<ReturnType<typeof initAdvancedSearch>> | null = null

function getServer() {
  if (serverPromise === null) {
    serverPromise = (async () => {
      const catalog = await ContentCatalog.get()
      const indexes: AdvancedIndex[] = catalog.getPosts(searchPostOptions()).map((post) => ({
        id: post.slug,
        url: post.slug,
        title: post.title,
        description: post.summary,
        structuredData: post.structuredData,
      }))
      return initAdvancedSearch({
        indexes,
        components: { tokenizer: createTokenizer() },
        // The Mandarin tokenizer segments by `Intl.Segmenter` word boundaries,
        // so segments are short and exact. Allowing typo tolerance or partial
        // term matches drowns the result set in noise (every paragraph
        // containing one of the segments shows up). `threshold: 0` requires
        // every term to be present and `tolerance: 0` disables fuzzy matching.
        search: { threshold: 0, tolerance: 0 },
      })
    })()
  }
  return serverPromise
}

export function resetSearchIndexForTest(): void {
  serverPromise = null
}

// Pre-build the index at module import so production never pays the cost on
// the first search request. Errors are logged but swallowed so dev/test
// imports still succeed; a real query will surface the failure via the awaited
// promise returned from `getServer()`.
void getServer().catch((err) => {
  console.error('[search] warmup failed', err)
})

// fumadocs returns SortedResult[] with one `page` entry per matched page plus
// per-heading/text entries; for our slug-based pagination we dedupe by page
// while preserving the ranking order produced by the engine.
function pageSlugFromResult(result: { type: string; id: string; url: string }): string {
  if (result.type === 'page') return result.id
  const hash = result.url.indexOf('#')
  return hash === -1 ? result.url : result.url.slice(0, hash)
}

export async function searchPosts(
  query: string,
  limit: number,
  offset: number = 0,
): Promise<{
  hits: string[]
  page: number
  totalPages: number
}> {
  const server = await getServer()
  const results = await server.search(query)
  const seen = new Set<string>()
  for (const result of results) {
    seen.add(pageSlugFromResult(result))
  }
  const totalHits = Array.from(seen)
  return {
    hits: totalHits.slice(offset, offset + limit),
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(totalHits.length / Math.max(limit, 1)),
  }
}
