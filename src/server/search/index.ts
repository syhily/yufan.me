import { create, insertMultiple, search as oramaSearch } from '@orama/orama'
import { createTokenizer } from '@orama/tokenizers/mandarin'

import type { PostVisibilityOptions } from '@/server/catalog'

import { ContentCatalog } from '@/server/catalog'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

// Search should only index posts that can also be rendered by the route.
// Hidden posts are intentionally searchable; scheduled posts stay dev-only for
// authoring checks and are excluded from production search results.
export function searchPostOptions(): PostVisibilityOptions {
  return { includeHidden: true, includeScheduled: import.meta.env.DEV }
}

interface SearchDoc {
  id: string
  url: string
  title: string
  description: string
}

type SearchDB = ReturnType<typeof createSearchDB>

function createSearchDB() {
  return create({
    schema: {
      id: 'string',
      url: 'string',
      title: 'string',
      description: 'string',
    } as const,
    components: {
      tokenizer: createTokenizer(),
    },
  })
}

// Lazily build the Orama search index on first query and cache the resulting
// Promise so concurrent requests share one build.
let serverPromise: Promise<SearchDB | null> | null = null

async function buildServer(): Promise<SearchDB | null> {
  const settings = await hydrateBlogSettings()
  if (settings === null) {
    return null
  }

  const catalog = await ContentCatalog.get()
  const docs: SearchDoc[] = catalog.getPosts(searchPostOptions()).map((post) => ({
    id: post.slug,
    url: post.slug,
    title: post.title,
    description: post.summary,
  }))

  const db = createSearchDB()
  if (docs.length > 0) {
    await insertMultiple(db, docs)
  }
  return db
}

function getServer(): Promise<SearchDB | null> {
  if (serverPromise === null) {
    serverPromise = buildServer().catch((error) => {
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
// the first search request.
void getServer().then(
  (server) => {
    if (server === null) {
      serverPromise = null
    }
  },
  (err) => {
    console.error('[search] warmup failed', err)
  },
)

export async function searchPosts(
  query: string,
  limit: number,
  offset: number = 0,
): Promise<{
  hits: string[]
  page: number
  totalPages: number
}> {
  const db = await getServer()
  if (db === null) {
    return { hits: [], page: 1, totalPages: 0 }
  }

  const results = await oramaSearch(db, {
    term: query,
    properties: ['title', 'description'],
    limit: 100,
    threshold: 0,
    tolerance: 0,
  })

  const hits = results.hits.map((hit) => hit.document.id)
  return {
    hits: hits.slice(offset, offset + limit),
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(hits.length / Math.max(limit, 1)),
  }
}
