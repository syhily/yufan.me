import type { CatalogEntry, CatalogSnapshot } from '@/server/catalog/snapshot'

import { buildCatalogSnapshot } from '@/server/catalog/build'
import { getCatalogVersion, subscribeCatalogInvalidate } from '@/server/catalog/invalidate'

// Process-level catalog cache. In a single Node.js process this is
// shared across all concurrent requests, which is safe because the
// snapshot is immutable once built. Cross-process consistency is
// maintained through the Redis-backed version key checked on every
// call. If the deployment model ever changes to true serverless
// (where each request may run in a fresh process), this should be
// replaced with a Redis or external cache.
class CatalogCache {
  private cached: CatalogSnapshot | null = null
  private inflight: Promise<CatalogSnapshot> | null = null
  private dirty = false
  private localVersion = 0

  constructor() {
    subscribeCatalogInvalidate(() => {
      this.dirty = true
    })
  }

  async getCatalog(): Promise<CatalogSnapshot> {
    if (this.cached !== null && !this.dirty) {
      const sharedVersion = await getCatalogVersion()
      if (sharedVersion <= this.localVersion) {
        return this.cached
      }
      this.dirty = true
    }
    if (this.inflight !== null) {
      return this.inflight
    }
    this.inflight = (async () => {
      const targetVersion = await getCatalogVersion()
      const snap = await buildCatalogSnapshot()
      this.cached = snap
      this.dirty = false
      this.localVersion = targetVersion
      this.inflight = null
      return snap
    })()
    return this.inflight
  }
}

const catalogCache = new CatalogCache()

export async function getCatalog(): Promise<CatalogSnapshot> {
  return catalogCache.getCatalog()
}

export async function getEntryBySlug(slug: string): Promise<CatalogEntry | null> {
  const snap = await getCatalog()
  return snap.bySlug.get(slug) ?? null
}

export { invalidateCatalog, subscribeCatalogInvalidate } from '@/server/catalog/invalidate'
export type { CatalogEntry, CatalogEntryType, CatalogSnapshot } from '@/server/catalog/snapshot'
export { CatalogConsistencyError } from '@/server/catalog/snapshot'

export { buildDbPage, findPageBySlug, listAllPages } from '@/server/pages/query'
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
  listPublicPostsWithContent,
  selectFeaturePosts,
  selectSidebarPosts,
} from '@/server/posts/query'
export {
  findCategoryByName,
  findCategoryBySlug,
  findTagByName,
  findTagBySlug,
  getCategoryLink,
  getCategoryLinks,
  getTagsByNames,
  listAllCategories,
  listAllFriends,
  listAllTags,
} from '@/server/catalog/queries'
export type {
  Category,
  ClientCategory,
  ClientPage,
  ClientPost,
  ClientPostWithMetadata,
  ClientTag,
  Friend,
  ListingPostCard,
  ListingPostCardWithMetadata,
  LoadPostsWithMetadataOptions,
  MarkdownHeading,
  Page,
  Post,
  PostMetadata,
  PostVisibilityOptions,
  SidebarPostLink,
  SidebarTagLink,
  Tag,
} from '@/shared/catalog'
export {
  toClientPage,
  toClientPost,
  toDetailPageShell,
  toDetailPostShell,
  toListingPostCard,
  toSidebarPostLink,
} from '@/shared/catalog'
