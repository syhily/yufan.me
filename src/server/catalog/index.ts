// Public surface of the content catalog. Re-exports from the new query layers
// so existing call sites can keep importing from `@/server/catalog`.
// New code should import directly from `@/server/posts/query` or `@/server/pages/query`.

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
