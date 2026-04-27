import type { ClientPost, ClientTag, SidebarPostLink } from '@/server/catalog'

import config from '@/blog.config'
// Avoid importing the projection helper through `@/server/catalog` —
// the index re-exports `getCatalog` (a `.server` module) which would drag
// the YAML/MDX loader graph into the sidebar unit test runtime. Importing
// the projection helper directly from the side-effect-free
// `@/server/catalog/projections` keeps `select.ts` cheap to load.
import { toSidebarPostLink } from '@/server/catalog/projections'
import { sampleSize, shuffle } from '@/shared/tools'

export function selectSidebarPosts(posts: ClientPost[]): SidebarPostLink[] {
  const randomSize = config.settings.sidebar.post
  if (randomSize <= 0) {
    return []
  }
  // Sample first, project second — `toSidebarPostLink` is cheap but the
  // sidebar only ships ~5 picks and there's no point projecting the whole
  // catalog when 99% of it gets discarded.
  const picks = posts.length <= randomSize ? posts : sampleSize(posts, randomSize)
  return picks.map(toSidebarPostLink)
}

export function selectSidebarTags(tags: ClientTag[]): ClientTag[] {
  const randomSize = config.settings.sidebar.tag
  if (randomSize <= 0) {
    return []
  }
  const topTags = tags
    .slice()
    .sort((a, b) => b.counts - a.counts)
    .slice(0, randomSize * 2)
  if (topTags.length <= randomSize) {
    return topTags
  }

  return sampleSize(topTags, randomSize)
}

// Daily-grain cache of the feature post selection. The selection only depends
// on (`seed` = today's date, plus a cheap input fingerprint that detects
// catalog edits), so we can avoid recomputing the seeded shuffle for every
// home request. The fingerprint combines `posts.length` (catches add/remove)
// with `posts[0]?.slug` (catches in-place edits that swap which post is
// newest, e.g. updating frontmatter `date`). A pure-length key would happily
// hand back yesterday's selection after a content edit.
const featurePostCache = new Map<string, ClientPost[]>()

export function selectFeaturePosts(posts: ClientPost[], seed: string): ClientPost[] {
  const featurePosts = config.settings.post.feature ?? []
  if (featurePosts.length >= 3) {
    return featurePosts
      .map((slug) => posts.find((post) => post.slug === slug))
      .filter((post): post is ClientPost => post !== undefined)
      .slice(0, 3)
  }

  if (posts.length < 3) {
    return posts
  }

  const cacheKey = `${seed}:${posts.length}:${posts[0]?.slug ?? ''}`
  const cached = featurePostCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  // Exclude the two most recent listing pages so "feature" never overlaps with
  // the fresh posts already rendered above the fold. Fall back to the full set
  // when the blog doesn't yet have that much material.
  const recentWindow = config.settings.pagination.posts * 2
  const candidates = posts.length > recentWindow ? posts.slice(recentWindow) : posts

  const withCover = candidates.filter((post) => post.cover)
  const pool = withCover.length >= 3 ? withCover : candidates
  if (pool.length < 3) {
    return pool
  }

  // Use `pool.length` instead of joining every slug — the seed already varies
  // by day so we don't need slug-level entropy here, and the previous
  // `.map(...).join("|")` allocated a few KB of throwaway strings per request.
  const result = shuffle(pool, `feature-posts:${seed}:${pool.length}`)
    .slice(0, 3)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))

  // Cap the cache. We only hold one entry per (day × catalog-shape), so the
  // upper bound is tiny in practice; the cap is purely defensive.
  if (featurePostCache.size > 32) {
    const oldest = featurePostCache.keys().next().value
    if (oldest !== undefined) {
      featurePostCache.delete(oldest)
    }
  }
  featurePostCache.set(cacheKey, result)
  return result
}
