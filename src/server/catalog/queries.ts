import { asc, inArray, sql } from 'drizzle-orm'

import type { Category, Friend, Tag } from '@/shared/catalog'

import { createInflight } from '@/server/cache/inflight'
import { db } from '@/server/db/pool'
import { findCategoryByName, findCategoryBySlug } from '@/server/db/query/category'
import { findTagByName, findTagBySlug } from '@/server/db/query/tag'
import { category as categoryTable, post as postMetaTable, tag as tagTable } from '@/server/db/schema'
import { listPublicFriends } from '@/server/friends/service'
import { hydrateImageRefs } from '@/server/images/render-enhance'
import { buildDbPage, findPageBySlug, listAllPages } from '@/server/pages/query'
import {
  buildPermalinkSet,
  findPostBySlug,
  findPostBySlugForAdmin,
  getClientPostsWithMetadata,
  getPostsBySlugs,
  listAllPosts,
  listClientPosts,
  listPostsByCategory,
  listPostsByTag,
  listPublicPostCards,
  listPublicPostCardsPaginated,
  selectFeaturePosts,
  selectSidebarPosts,
} from '@/server/posts/query'

// Re-export everything so existing call sites keep working during migration.
// This file is a thin adapter layer; new code should import directly from
// @/server/posts/query or @/server/pages/query.

export {
  buildPermalinkSet,
  findPostBySlug,
  findPostBySlugForAdmin,
  getClientPostsWithMetadata,
  getPostsBySlugs,
  listAllPosts,
  listClientPosts,
  listPostsByCategory,
  listPostsByTag,
  listPublicPostCards,
  listPublicPostCardsPaginated,
  selectFeaturePosts,
  selectSidebarPosts,
}
export { buildDbPage, findPageBySlug, listAllPages }

// --- Categories --------------------------------------------------------------

async function hydrateCategoryImages(categories: Category[]): Promise<void> {
  await hydrateImageRefs(
    categories,
    (c) => c.cover,
    (c, lookup) => {
      c.coverThumbhash = lookup?.thumbhash
      if (lookup?.publicUrl != null) {
        c.cover = lookup.publicUrl
      }
    },
  )
}

export async function listAllCategories(): Promise<Category[]> {
  const now = new Date()
  const rows = await db
    .select({
      name: categoryTable.name,
      slug: categoryTable.slug,
      cover: categoryTable.cover,
      description: categoryTable.description,
      counts: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM ${postMetaTable}
        WHERE ${postMetaTable.category} = ${categoryTable.name}
          AND ${postMetaTable.deletedAt} IS NULL
          AND ${postMetaTable.published} = true
          AND ${postMetaTable.visible} = true
          AND ${postMetaTable.publishedAt} <= ${now}
      ), 0)`.as('counts'),
    })
    .from(categoryTable)
    .orderBy(asc(categoryTable.sortOrder), asc(categoryTable.id))

  const categories: Category[] = []
  for (const row of rows) {
    categories.push({
      name: row.name,
      slug: row.slug,
      cover: row.cover,
      description: row.description,
      counts: row.counts,
      permalink: `/cats/${row.slug}`,
    })
  }

  await hydrateCategoryImages(categories)
  return categories
}

export { findCategoryByName, findCategoryBySlug }

export async function getCategoryLink(name: string): Promise<string> {
  const category = await findCategoryByName(name)
  return category ? `/cats/${category.slug}` : ''
}

// --- Tags --------------------------------------------------------------------

let tagCache: Tag[] | null = null
let tagCacheAt = 0
const TAG_CACHE_TTL_MS = 30_000
const tagInflight = createInflight<Tag[]>()

export async function listAllTags(): Promise<Tag[]> {
  if (tagCache !== null && Date.now() - tagCacheAt < TAG_CACHE_TTL_MS) {
    return tagCache
  }

  return tagInflight('listAllTags', async () => {
    // Double-checked locking: another concurrent call may have filled the
    // cache while we were waiting on the inflight promise.
    if (tagCache !== null && Date.now() - tagCacheAt < TAG_CACHE_TTL_MS) {
      return tagCache
    }

    const now = new Date()

    // Query 1: all tags (small table, fast).
    const tagRows = await db
      .select({ name: tagTable.name, slug: tagTable.slug })
      .from(tagTable)
      .orderBy(asc(tagTable.name))

    if (tagRows.length === 0) {
      tagCache = []
      tagCacheAt = Date.now()
      return []
    }

    // Query 2: aggregated counts for every tag in one shot.
    // Replaces the historical N+1 correlated subquery (one COUNT(*) per tag).
    const countsResult = await db.execute<{ tag_name: string; counts: number }>(sql`
      SELECT jsonb_array_elements_text(${postMetaTable.tags}) AS tag_name,
             COUNT(*)::int AS counts
      FROM ${postMetaTable}
      WHERE ${postMetaTable.deletedAt} IS NULL
        AND ${postMetaTable.published} = true
        AND ${postMetaTable.visible} = true
        AND ${postMetaTable.publishedAt} <= ${now}
      GROUP BY jsonb_array_elements_text(${postMetaTable.tags})
    `)

    const countsMap = new Map<string, number>()
    for (const row of countsResult.rows) {
      countsMap.set(row.tag_name, row.counts)
    }

    const tags = tagRows.map((row) => ({
      name: row.name,
      slug: row.slug,
      counts: countsMap.get(row.name) ?? 0,
      permalink: `/tags/${row.slug}`,
    }))

    tagCache = tags
    tagCacheAt = Date.now()
    return tags
  })
}

export { findTagByName, findTagBySlug }

export async function getTagsByNames(names: readonly string[]): Promise<Tag[]> {
  if (names.length === 0) {
    return []
  }
  const uniqueNames = [...new Set(names)]
  const now = new Date()

  // Query 1 + 2 in parallel: tags and their usage counts.
  const tagRowsPromise = db
    .select({ name: tagTable.name, slug: tagTable.slug })
    .from(tagTable)
    .where(inArray(tagTable.name, uniqueNames))
  const countsResultPromise = db.execute<{ tag_name: string; counts: number }>(sql`
    SELECT jsonb_array_elements_text(${postMetaTable.tags}) AS tag_name,
           COUNT(*)::int AS counts
    FROM ${postMetaTable}
    WHERE ${postMetaTable.deletedAt} IS NULL
      AND ${postMetaTable.published} = true
      AND ${postMetaTable.visible} = true
      AND ${postMetaTable.publishedAt} <= ${now}
    GROUP BY jsonb_array_elements_text(${postMetaTable.tags})
  `)
  const [tagRows, countsResult] = (await Promise.all([tagRowsPromise, countsResultPromise])) as [
    Awaited<typeof tagRowsPromise>,
    Awaited<typeof countsResultPromise>,
  ]

  if (tagRows.length === 0) {
    return []
  }

  const countsMap = new Map<string, number>()
  for (const row of countsResult.rows) {
    countsMap.set(row.tag_name, row.counts)
  }

  const tagMap = new Map(
    tagRows.map((r) => [
      r.name,
      {
        name: r.name,
        slug: r.slug,
        counts: countsMap.get(r.name) ?? 0,
        permalink: `/tags/${r.slug}`,
      } as Tag,
    ]),
  )

  return names.map((name) => tagMap.get(name)).filter(Boolean) as Tag[]
}

export async function getCategoryLinks(names: readonly string[]): Promise<Record<string, string>> {
  const uniqueNames = [...new Set(names.filter((n): n is string => Boolean(n)))]
  if (uniqueNames.length === 0) {
    return {}
  }

  const rows = await db
    .select({ name: categoryTable.name, slug: categoryTable.slug })
    .from(categoryTable)
    .where(inArray(categoryTable.name, uniqueNames))

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.name] = `/cats/${row.slug}`
  }
  return result
}

// --- Friends -----------------------------------------------------------------

async function hydrateFriendImages(friends: Friend[]): Promise<void> {
  await hydrateImageRefs(
    friends,
    (f) => f.poster,
    (f, lookup) => {
      f.posterThumbhash = lookup?.thumbhash
      if (lookup?.publicUrl != null) {
        f.poster = lookup.publicUrl
      }
    },
  )
}

export async function listAllFriends(): Promise<Friend[]> {
  const rows = await listPublicFriends()
  const friends = rows.map((row) => ({
    website: row.website,
    description: row.description,
    homepage: row.homepage,
    poster: row.poster,
  }))
  await hydrateFriendImages(friends)
  return friends
}
