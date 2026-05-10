import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import type { PostMetaRow } from '@/server/db/types'
import type { ClientPost, ListingPostCard, Post, PostVisibilityOptions, SidebarPostLink } from '@/shared/catalog'

import { findContentById, findContentsByIds, listPublicPageMetas } from '@/server/cms/pages/repository'
import { toCmsPost } from '@/server/cms/posts/projection'
import {
  countPublicPosts,
  findPostMetaBySlug,
  findPublicPostMetaBySlug,
  listPublicPosts,
  type ListPublicPostsFilters,
} from '@/server/cms/posts/repository'
import { queryMetadata } from '@/server/comments/likes'
import { db } from '@/server/db/pool'
import { post as postMetaTable } from '@/server/db/schema'
import { loadImageThumbhash } from '@/server/images/render-enhance'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { toListingPostCard, toSidebarPostLink } from '@/shared/catalog'
import { shuffle } from '@/shared/tools'

// --- Hydration ---------------------------------------------------------------

async function hydratePostImages(posts: Post[]): Promise<void> {
  const uniqueCovers = [...new Set(posts.map((p) => p.cover).filter((c) => c !== ''))]
  const lookups = await Promise.all(uniqueCovers.map((cover) => loadImageThumbhash(cover)))
  const lookupMap = new Map(uniqueCovers.map((c, i) => [c, lookups[i]]))
  for (const post of posts) {
    const lookup = post.cover === '' ? null : (lookupMap.get(post.cover) ?? null)
    post.coverThumbhash = lookup?.thumbhash
    if (lookup?.publicUrl != null) {
      post.cover = lookup.publicUrl
    }
  }
}

/** Join published `content` rows so callers receive a real `Post` with `body` (RSS, detail routes, etc.). */
async function hydratePostMetasToFullPosts(metas: PostMetaRow[]): Promise<Post[]> {
  if (metas.length === 0) {
    return []
  }
  const revisionIds = metas.map((m) => m.publishedRevisionId).filter((id): id is bigint => id !== null)
  const revisionMap = new Map<bigint, Awaited<ReturnType<typeof findContentsByIds>>[number]>()
  if (revisionIds.length > 0) {
    const rows = await findContentsByIds(revisionIds)
    for (const row of rows) {
      revisionMap.set(row.id, row)
    }
  }
  const posts = metas.map((meta) => {
    const revision = meta.publishedRevisionId === null ? null : (revisionMap.get(meta.publishedRevisionId) ?? null)
    return toCmsPost(meta, revision) as unknown as Post
  })
  await hydratePostImages(posts)
  return posts
}

/**
 * Like {@link listAllPosts} but loads Portable Text bodies + headings from the
 * published `content` revision. Prefer this when rendering post HTML (feeds);
 * use {@link listAllPosts} when only metadata is needed (sitemap, search index).
 */
export async function listPublicPostsWithContent(
  options?: PostVisibilityOptions & {
    category?: string
    tag?: string
    sortBy?: 'publishedAt' | 'updatedAt'
  },
): Promise<Post[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({
    ...filters,
    category: options?.category,
    tag: options?.tag,
    sortBy: options?.sortBy,
  })
  return hydratePostMetasToFullPosts(metas)
}

// --- Lightweight projection (no content join) --------------------------------

/** Public `date` is first publication time; falls back to `published_at` before the first publish. */
function toClientPostFromMeta(meta: PostMetaRow): ClientPost {
  const date = meta.firstPublishedAt ?? meta.publishedAt
  return {
    id: String(meta.id),
    title: meta.title,
    date,
    updated: meta.publishedAt,
    comments: meta.commentsEnabled,
    alias: (meta.alias as string[]) ?? [],
    tags: (meta.tags as string[]) ?? [],
    category: meta.category,
    summary: meta.summary,
    cover: meta.cover,
    og: meta.og ?? undefined,
    published: meta.published,
    visible: meta.visible,
    toc: meta.showToc,
    slug: meta.slug,
    permalink: `/posts/${meta.slug}`,
    headings: [],
    pinnedAt: meta.pinnedAt ?? undefined,
  }
}

function buildPublicPostFilters(
  options?: PostVisibilityOptions,
): Omit<ListPublicPostsFilters, 'sortBy' | 'limit' | 'offset'> {
  return {
    includeHidden: options?.includeHidden ?? false,
    includeScheduled: options?.includeScheduled ?? false,
  }
}

// --- Single lookups ----------------------------------------------------------

export async function findPostBySlug(slug: string): Promise<Post | null> {
  const meta = await findPublicPostMetaBySlug(slug)
  if (meta === null) {
    return null
  }
  const revision = meta.publishedRevisionId === null ? null : await findContentById(meta.publishedRevisionId)
  const post = toCmsPost(meta, revision) as unknown as Post
  await hydratePostImages([post])
  return post
}

export async function findPostBySlugForAdmin(slug: string): Promise<Post | null> {
  const meta = await findPostMetaBySlug(slug)
  if (meta === null) {
    return null
  }
  const revision = meta.publishedRevisionId === null ? null : await findContentById(meta.publishedRevisionId)
  const post = toCmsPost(meta, revision) as unknown as Post
  await hydratePostImages([post])
  return post
}

// --- Listing queries ---------------------------------------------------------

export async function listPublicPostCards(
  options?: PostVisibilityOptions & { sortBy?: 'publishedAt' | 'updatedAt' },
): Promise<ListingPostCard[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({ ...filters, sortBy: options?.sortBy })
  return metas.map((meta) => toClientPostFromMeta(meta)).map(toListingPostCard)
}

export async function listPublicPostCardsPaginated(
  pageNum: number,
  pageSize: number,
  options?: PostVisibilityOptions & {
    sortBy?: 'publishedAt' | 'updatedAt'
    category?: string
    tag?: string
    /** Override the default offset (`(pageNum - 1) * pageSize`). Used when the
        caller's pagination logic expands the last-page limit (tail-merge) so
        the offset must still be based on the original page size. */
    offset?: number
  },
): Promise<{ posts: ListingPostCard[]; total: number }> {
  const filters = buildPublicPostFilters(options)
  const offset = options?.offset ?? (pageNum - 1) * pageSize
  const [metas, total] = await Promise.all([
    listPublicPosts({
      ...filters,
      sortBy: options?.sortBy,
      category: options?.category,
      tag: options?.tag,
      limit: pageSize,
      offset,
    }),
    countPublicPosts({ ...filters, category: options?.category, tag: options?.tag }),
  ])
  return { posts: metas.map((meta) => toClientPostFromMeta(meta)).map(toListingPostCard), total }
}

export async function listPostsByCategory(category: string, options?: PostVisibilityOptions): Promise<Post[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({ ...filters, category })
  const posts = metas.map((meta) => toClientPostFromMeta(meta) as unknown as Post)
  await hydratePostImages(posts)
  return posts
}

export async function listPostsByTag(tag: string, options?: PostVisibilityOptions): Promise<Post[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({ ...filters, tag })
  const posts = metas.map((meta) => toClientPostFromMeta(meta) as unknown as Post)
  await hydratePostImages(posts)
  return posts
}

export async function getPostsBySlugs(slugs: readonly string[], options?: PostVisibilityOptions): Promise<Post[]> {
  if (slugs.length === 0) {
    return []
  }
  const filters = buildPublicPostFilters(options)
  const rows = await db
    .select()
    .from(postMetaTable)
    .where(and(inArray(postMetaTable.slug, [...slugs]), isNull(postMetaTable.deletedAt)))
    .orderBy(desc(postMetaTable.firstPublishedAt))

  const now = new Date()
  const posts = rows
    .filter((meta) => {
      const visible = filters.includeHidden || meta.visible
      const published = filters.includeScheduled || meta.publishedAt <= now
      return visible && published && meta.published
    })
    .map((meta) => toClientPostFromMeta(meta) as unknown as Post)
  await hydratePostImages(posts)
  return posts
}

export async function listAllPosts(options?: PostVisibilityOptions): Promise<Post[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({ ...filters })
  const posts = metas.map((meta) => toClientPostFromMeta(meta) as unknown as Post)
  await hydratePostImages(posts)
  return posts
}

export async function listClientPosts(options?: PostVisibilityOptions): Promise<ClientPost[]> {
  const filters = buildPublicPostFilters(options)
  const metas = await listPublicPosts({ ...filters })
  return metas.map((meta) => toClientPostFromMeta(meta))
}

// --- Metadata ----------------------------------------------------------------

export async function getClientPostsWithMetadata<PostLike extends { permalink: string }>(
  posts: PostLike[],
  options: { likes: boolean; views: boolean; comments: boolean },
): Promise<(PostLike & { meta: { likes: number; views: number; comments: number } })[]> {
  if (posts.length === 0) {
    return []
  }
  const metas = await queryMetadata(
    posts.map((post) => post.permalink),
    options,
  )
  return posts.map((post) => {
    const meta = metas.get(post.permalink) ?? { likes: 0, views: 0, comments: 0 }
    return { ...post, meta }
  })
}

// --- Feature / Sidebar -------------------------------------------------------

const FEATURE_POST_COUNT = 3

export async function selectFeaturePosts(seed: string): Promise<ClientPost[]> {
  const content = requireBlogSettingsSection('content')
  if (!content.post.featureEnabled) {
    return []
  }

  const now = new Date()
  const publicWhere = and(
    isNull(postMetaTable.deletedAt),
    eq(postMetaTable.published, true),
    eq(postMetaTable.visible, true),
    sql`${postMetaTable.publishedAt} <= ${now}`,
  )

  // 1. Pinned posts
  const pinnedMetas = await db
    .select()
    .from(postMetaTable)
    .where(and(publicWhere, isNotNull(postMetaTable.pinnedAt)))
    .orderBy(desc(postMetaTable.pinnedAt))
    .limit(FEATURE_POST_COUNT)

  const pinned = pinnedMetas.map((meta) => toClientPostFromMeta(meta))
  if (pinned.length === FEATURE_POST_COUNT) {
    return pinned
  }

  // 2. Recent window to exclude
  const pageSize = content.pagination.posts
  const recentWindow = pageSize * 2

  const [recentMetas, allWithCover] = await Promise.all([
    db
      .select({ id: postMetaTable.id })
      .from(postMetaTable)
      .where(publicWhere)
      .orderBy(desc(postMetaTable.firstPublishedAt))
      .limit(recentWindow),
    db
      .select()
      .from(postMetaTable)
      .where(and(publicWhere, sql`${postMetaTable.cover} <> ''`))
      .orderBy(desc(postMetaTable.firstPublishedAt)),
  ])

  const recentIds = new Set(recentMetas.map((r) => r.id))
  const pinnedSlugs = new Set(pinned.map((p) => p.slug))
  const candidates = allWithCover
    .filter((m) => !pinnedSlugs.has(m.slug) && !recentIds.has(m.id))
    .map((meta) => toClientPostFromMeta(meta))

  const withCover = candidates.filter((post) => post.cover)
  const pool = withCover.length >= FEATURE_POST_COUNT - pinned.length ? withCover : candidates

  if (pool.length + pinned.length < FEATURE_POST_COUNT) {
    const fallbackPool = candidates
    return [...pinned, ...fallbackPool].slice(0, FEATURE_POST_COUNT)
  }

  // Deterministic shuffle using the daily seed so the same date always
  // yields the same feature picks.
  const shuffled = shuffle(pool, `feature-posts:${seed}:${pool.length}`)
  return [...pinned, ...shuffled.slice(0, FEATURE_POST_COUNT - pinned.length)]
}

export async function selectSidebarPosts(count: number): Promise<SidebarPostLink[]> {
  if (count <= 0) {
    return []
  }
  const metas = await db
    .select()
    .from(postMetaTable)
    .where(
      and(
        isNull(postMetaTable.deletedAt),
        eq(postMetaTable.published, true),
        eq(postMetaTable.visible, true),
        sql`${postMetaTable.publishedAt} <= ${new Date()}`,
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(count)
  return metas.map((meta) => toClientPostFromMeta(meta)).map(toSidebarPostLink)
}

// --- Permalink set -----------------------------------------------------------

export async function buildPermalinkSet(): Promise<Set<string>> {
  const [postMetas, pageMetas] = await Promise.all([listPublicPosts({}), listPublicPageMetas()])
  return new Set([...postMetas.map((p) => `/posts/${p.slug}`), ...pageMetas.map((p) => `/${p.slug}`)])
}
export { countPublicPosts }
