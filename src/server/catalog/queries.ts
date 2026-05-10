import { asc, eq, sql } from 'drizzle-orm'

import type { Category, ClientPost, Friend, Page, Post, PostVisibilityOptions, Tag } from '@/shared/catalog'

import { db } from '@/server/db/pool'
import { findCategoryByName, findCategoryBySlug } from '@/server/db/query/category'
import { findTagByName, findTagBySlug } from '@/server/db/query/tag'
import { category as categoryTable, post as postMetaTable, tag as tagTable } from '@/server/db/schema'
import { listPublicFriends } from '@/server/friends/service'
import { loadImageThumbhash } from '@/server/images/render-enhance'
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
  const uniqueCovers = [...new Set(categories.map((c) => c.cover).filter((c) => c !== ''))]
  const lookups = await Promise.all(uniqueCovers.map((cover) => loadImageThumbhash(cover)))
  const lookupMap = new Map(uniqueCovers.map((c, i) => [c, lookups[i]]))
  for (const category of categories) {
    const lookup = category.cover === '' ? null : (lookupMap.get(category.cover) ?? null)
    category.coverThumbhash = lookup?.thumbhash
    if (lookup?.publicUrl != null) category.cover = lookup.publicUrl
  }
}

async function parseCategoryDescription(description: string): Promise<string> {
  if (description === '') return ''
  const { parseContent } = await import('@/server/markdown/parser')
  return parseContent(description)
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
      description: await parseCategoryDescription(row.description),
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

export async function listAllTags(): Promise<Tag[]> {
  const now = new Date()
  const rows = await db
    .select({
      name: tagTable.name,
      slug: tagTable.slug,
      counts: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM ${postMetaTable}
        WHERE ${postMetaTable.tags} @> jsonb_build_array(${tagTable.name})
          AND ${postMetaTable.deletedAt} IS NULL
          AND ${postMetaTable.published} = true
          AND ${postMetaTable.visible} = true
          AND ${postMetaTable.publishedAt} <= ${now}
      ), 0)`.as('counts'),
    })
    .from(tagTable)
    .orderBy(asc(tagTable.name))

  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    counts: row.counts,
    permalink: `/tags/${row.slug}`,
  }))
}

export { findTagByName, findTagBySlug }

export async function getTagsByNames(names: readonly string[]): Promise<Tag[]> {
  const tags = await listAllTags()
  const tagMap = new Map(tags.map((t) => [t.name, t]))
  return names.map((name) => tagMap.get(name)).filter(Boolean) as Tag[]
}

// --- Friends -----------------------------------------------------------------

async function hydrateFriendImages(friends: Friend[]): Promise<void> {
  const uniquePosters = [...new Set(friends.map((f) => f.poster).filter((p) => p !== ''))]
  const lookups = await Promise.all(uniquePosters.map((poster) => loadImageThumbhash(poster)))
  const lookupMap = new Map(uniquePosters.map((p, i) => [p, lookups[i]]))
  for (const friend of friends) {
    const lookup = friend.poster === '' ? null : (lookupMap.get(friend.poster) ?? null)
    friend.posterThumbhash = lookup?.thumbhash
    if (lookup?.publicUrl != null) friend.poster = lookup.publicUrl
  }
}

export async function listAllFriends(): Promise<Friend[]> {
  const friends = (await listPublicFriends()).map((row) => ({
    website: row.website,
    description: row.description,
    homepage: row.homepage,
    poster: row.poster,
  }))
  await hydrateFriendImages(friends)
  return friends
}
