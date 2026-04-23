import type { DocumentData } from 'flexsearch'

import { Document } from 'flexsearch'

import type { Post } from '@/data/content/catalog'

import { ContentCatalog } from '@/data/content/catalog'

interface PostItem extends DocumentData {
  title: string
  slug: string
  raw: string
  tags: string[]
}

// In-memory FlexSearch index built lazily on first query. Building during
// import was forcing a top-level await on every consumer, including pages
// that never used search. We now defer until the first call and cache the
// resulting Promise so concurrent requests share one build.
let indexPromise: Promise<{ index: Document<PostItem>; bySlug: Map<string, Post> }> | null = null

async function getIndex() {
  if (indexPromise === null) {
    indexPromise = (async () => {
      const catalog = await ContentCatalog.get()
      const index = new Document<PostItem>({
        tokenize: 'full',
        document: {
          id: 'slug',
          index: ['title', 'tags'],
          tag: 'tags',
        },
      })
      const bySlug = new Map<string, Post>()
      for (const post of catalog.getPosts({ hidden: true, schedule: true })) {
        bySlug.set(post.slug, post)
        index.add({
          title: post.title,
          slug: post.slug,
          raw: post.summary,
          tags: post.tags,
        })
      }
      return { index, bySlug }
    })()
  }
  return indexPromise
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
  const { index } = await getIndex()
  // FlexSearch returns hits per indexed field; merge with a Set so the
  // deduplication is O(N) instead of the previous O(N^2) `[...new Set(arr)]`
  // chained over a flatMap of arrays.
  const seen = new Set<string>()
  for (const { result } of index.search(query)) {
    for (const id of result) {
      seen.add(String(id))
    }
  }
  const totalHits = Array.from(seen)
  return {
    hits: totalHits.slice(offset, offset + limit),
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(totalHits.length / Math.max(limit, 1)),
  }
}
