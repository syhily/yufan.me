// Public surface of the content catalog. Two design rules:
//
// 1. The `ContentCatalog` singleton is the only source of truth — anything
//    you'd reach for via a wrapper (`getPosts`, `getCategoryByName`, ...) is
//    a method on the resolved instance. Use `getCatalog()` to await it once
//    per loader and call methods directly afterwards.
// 2. Schema types and DTO converters are re-exported here so call sites can
//    import everything they need from `@/server/catalog` without crossing
//    private file boundaries.

import { ContentCatalog } from '@/server/catalog/catalog'

export { ContentCatalog } from '@/server/catalog/catalog'
export { getClientPostsWithMetadata } from '@/server/catalog/catalog'
export type {
  Category,
  ClientCategory,
  ClientPage,
  ClientPost,
  ClientPostWithMetadata,
  ClientTag,
  Friend,
  LoadPostsWithMetadataOptions,
  MarkdownHeading,
  Page,
  Post,
  PostMetadata,
  PostVisibilityOptions,
  Tag,
} from '@/server/catalog/schema'
export { toClientPage, toClientPost } from '@/server/catalog/schema'
export type {
  CommentFormUser,
  DetailPageShell,
  DetailPostShell,
  ListingPostCard,
  ListingPostCardWithMetadata,
  SidebarPostLink,
  SidebarTagLink,
} from '@/server/catalog/projections'
export {
  toDetailPageShell,
  toDetailPostShell,
  toListingPostCard,
  toSidebarPostLink,
} from '@/server/catalog/projections'

// Resolve the singleton once. Loaders should `const cat = await getCatalog()`
// and then read whichever fields/methods they need synchronously.
export function getCatalog() {
  return ContentCatalog.get()
}
