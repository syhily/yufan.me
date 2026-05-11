import { and, cosineDistance, desc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/server/db/pool'
import { post, postSearchIndex } from '@/server/db/schema'
import { getLogger } from '@/server/logger'
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

  const pattern = `%${trimmed.replace(/[%_]/g, '\\$&')}%`
  const baseWhere = and(isNull(post.deletedAt), eq(post.published, true))
  const likeWhere = and(
    baseWhere,
    or(
      ilike(post.title, pattern),
      ilike(post.summary, pattern),
      ilike(sql`COALESCE(${postSearchIndex.plainText}, '')`, pattern),
    ),
  )

  // --- Vector + LIKE hybrid mode ---
  if (settings.enabled && settings.mode === 'vector') {
    const embedding = await generateEmbedding(trimmed)
    getLogger('search.vector').info('Search vector query', {
      query: trimmed,
      hasEmbedding: embedding !== null,
      dimensions: embedding?.length ?? 0,
      threshold: settings.similarityThreshold,
    })

    if (embedding !== null) {
      const similarity = sql<number>`1 - (${cosineDistance(postSearchIndex.embedding, embedding)})`

      const [vectorRows, likeRows] = await Promise.all([
        db
          .select({ slug: post.slug, similarity })
          .from(post)
          .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
          .where(and(baseWhere, gt(similarity, settings.similarityThreshold)))
          .orderBy(desc(similarity))
          .limit(100),
        db
          .select({ slug: post.slug })
          .from(post)
          .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
          .where(likeWhere)
          .orderBy(desc(post.publishedAt))
          .limit(100),
      ])

      getLogger('search.vector').info('Search vector results', {
        query: trimmed,
        rawRows: vectorRows.length,
        threshold: settings.similarityThreshold,
        topSimilarity: vectorRows[0]?.similarity ?? null,
      })

      getLogger('search.like').info('Search LIKE results', {
        query: trimmed,
        rawRows: likeRows.length,
      })

      // Merge: vector results first, then LIKE results deduplicated
      const seen = new Set<string>()
      const merged: string[] = []
      for (const row of vectorRows) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug)
          merged.push(row.slug)
        }
      }
      for (const row of likeRows) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug)
          merged.push(row.slug)
        }
      }

      const hits = merged.slice(offset, offset + limit)
      const total = merged.length
      return {
        hits,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / Math.max(limit, 1)),
      }
    }
    // embedding generation failed → fall through to LIKE
  }

  // --- LIKE fallback ---
  const rows = await db
    .select({ slug: post.slug })
    .from(post)
    .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
    .where(likeWhere)
    .orderBy(desc(post.publishedAt))
    .limit(limit + offset)

  getLogger('search.like').info('Search LIKE results', {
    query: trimmed,
    rawRows: rows.length,
  })

  const hits = rows.slice(offset).map((r) => r.slug)
  const total = rows.length
  return {
    hits,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / Math.max(limit, 1)),
  }
}
