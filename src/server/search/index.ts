import { and, cosineDistance, desc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/server/db/pool'
import { post, postSearchIndex } from '@/server/db/schema'
import { getBlogSettingsBundleSync } from '@/shared/blog-config'

import { generateEmbedding } from './openai'
import { searchPostOptions } from './options'

export { searchPostOptions }

const DEFAULT_SEARCH_SETTINGS = {
  enabled: false,
  mode: 'like' as const,
  apiKey: '',
  model: 'text-embedding-3-small',
  similarityThreshold: 0.5,
}

function getSearchSettings() {
  const bundle = getBlogSettingsBundleSync()
  return bundle?.search?.search ?? DEFAULT_SEARCH_SETTINGS
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
  const settings = getSearchSettings()
  const trimmed = query.trim()
  if (trimmed === '') {
    return { hits: [], page: 1, totalPages: 0 }
  }

  // --- Vector mode ---
  if (settings.enabled && settings.mode === 'vector') {
    const embedding = await generateEmbedding(trimmed)
    if (embedding !== null) {
      const similarity = sql<number>`1 - (${cosineDistance(postSearchIndex.embedding, embedding)})`
      const rows = await db
        .select({ slug: post.slug, similarity })
        .from(post)
        .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
        .where(and(isNull(post.deletedAt), eq(post.published, true), gt(similarity, settings.similarityThreshold)))
        .orderBy(desc(similarity))
        .limit(limit + offset)

      const hits = rows.slice(offset).map((r) => r.slug)
      const total = rows.length
      return {
        hits,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / Math.max(limit, 1)),
      }
    }
    // embedding generation failed → fall through to LIKE
  }

  // --- LIKE fallback ---
  // Search across title, summary, and plain text body. Use LEFT JOIN so
  // posts that haven't been indexed yet (no row in post_search_index)
  // are still discoverable via their title / summary.
  const pattern = `%${trimmed.replace(/[%_]/g, '\\$&')}%`
  const rows = await db
    .select({ slug: post.slug })
    .from(post)
    .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
    .where(
      and(
        isNull(post.deletedAt),
        eq(post.published, true),
        or(
          ilike(post.title, pattern),
          ilike(post.summary, pattern),
          ilike(sql`COALESCE(${postSearchIndex.plainText}, '')`, pattern),
        ),
      ),
    )
    .orderBy(desc(post.publishedAt))
    .limit(limit + offset)

  const hits = rows.slice(offset).map((r) => r.slug)
  const total = rows.length
  return {
    hits,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / Math.max(limit, 1)),
  }
}
