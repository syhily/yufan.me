import { createTokenizer } from '@orama/tokenizers/mandarin'
import { type AdvancedIndex, initAdvancedSearch } from 'fumadocs-core/search/server'

import type { PostVisibilityOptions } from '@/server/catalog'

import { ContentCatalog } from '@/server/catalog'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

// Search should only index posts that can also be rendered by the route.
// Hidden posts are intentionally searchable; scheduled posts stay dev-only for
// authoring checks and are excluded from production search results.
export function searchPostOptions(): PostVisibilityOptions {
  return { includeHidden: true, includeScheduled: import.meta.env.DEV }
}

// Lazily build the Orama-backed fumadocs search server on first query and
// cache the resulting Promise so concurrent requests share one build.
//
// The cached promise resolves to either a built search server OR
// `null` (the deployment is uninstalled). Storing `null` for the
// uninstalled state lets the warmup short-circuit silently — building
// is genuinely impossible until the install flow has populated the
// blog settings — without polluting the dev console with a fake
// "warmup failed" error every time the server boots before installation.
//
// `null` is intentionally NOT cached forever: the install action calls
// `resetSearchIndexForTest()`-equivalent eviction via `refreshBlogSettings()
// → hydrateBlogSettings()`, but the search module itself is decoupled
// from that lifecycle. We instead clear the cached `null` opportunistically
// from `getServer()` so the next request after install rebuilds the
// index. Real failures (DB timeout, fumadocs init throw) still throw
// and evict the cache so the next caller can retry.
type SearchServer = ReturnType<typeof initAdvancedSearch>
let serverPromise: Promise<SearchServer | null> | null = null

async function buildServer(): Promise<SearchServer | null> {
  // The catalog reads `post.sort` / `post.feature` from the live
  // `BlogSettings` snapshot. Wait for hydration before building so a
  // pre-install warmup doesn't trip `requireBlogConfig()`. If the
  // deployment is uninstalled (`null`), resolve to `null` so the
  // warmup stays silent — `getServer()` will rebuild on the next
  // request once the install flow finishes.
  const settings = await hydrateBlogSettings()
  if (settings === null) return null

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
}

function getServer(): Promise<SearchServer | null> {
  if (serverPromise === null) {
    serverPromise = buildServer().catch((error) => {
      // Real failure (not the uninstalled short-circuit, which resolves
      // to `null`). Evict the cached promise so the next request
      // retries instead of being permanently pinned at the failure.
      serverPromise = null
      throw error
    })
  }
  return serverPromise
}

export function resetSearchIndexForTest(): void {
  serverPromise = null
}

// Pre-build the index at module import so production never pays the cost on
// the first search request. The promise resolves to `null` on uninstalled
// deployments — silent on purpose, the eventual install flow will trigger
// a rebuild via the next `getServer()` call. Genuine failures are logged.
void getServer().then(
  (server) => {
    if (server === null) {
      // Uninstalled — drop the cached `null` so the next request after
      // install rebuilds. Logging here would spam the dev console on
      // every restart of a fresh deployment, so stay silent.
      serverPromise = null
    }
  },
  (err) => {
    console.error('[search] warmup failed', err)
  },
)

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
  // Uninstalled deployments resolve to `null` from `getServer()`. Public
  // search routes are gated by the install middleware in production, so
  // the only way to land here pre-install is a direct in-process call
  // (e.g. an internal warm-up). Returning an empty page is correct in
  // both shapes.
  if (server === null) {
    return { hits: [], page: 1, totalPages: 0 }
  }
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
