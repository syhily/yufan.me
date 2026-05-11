import type { CatalogEntry, CatalogSnapshot } from '@/server/catalog/snapshot'

import { buildCatalogSnapshot } from '@/server/catalog/build'
import { getCatalogVersion, subscribeCatalogInvalidate } from '@/server/catalog/invalidate'

let cached: CatalogSnapshot | null = null
let inflight: Promise<CatalogSnapshot> | null = null
let dirty = false
let localVersion = 0

subscribeCatalogInvalidate(() => {
  dirty = true
})

export async function getCatalog(): Promise<CatalogSnapshot> {
  if (cached !== null && !dirty) {
    const sharedVersion = await getCatalogVersion()
    if (sharedVersion <= localVersion) {
      return cached
    }
    dirty = true
  }
  if (inflight !== null) {
    return inflight
  }
  inflight = (async () => {
    const targetVersion = await getCatalogVersion()
    const snap = await buildCatalogSnapshot()
    cached = snap
    dirty = false
    localVersion = targetVersion
    inflight = null
    return snap
  })()
  return inflight
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
