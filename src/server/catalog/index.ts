// Public surface of the content catalog. Two design rules:
//
// 1. The `ContentCatalog` singleton is the only source of truth — anything
//    you'd reach for via a wrapper (`getPosts`, `getCategoryByName`, ...) is
//    a method on the resolved instance. Use `getCatalog()` to await it once
//    per loader and call methods directly afterwards.
// 2. Schema types and DTO converters are re-exported here so call sites can
//    import everything they need from `@/server/catalog` without crossing
//    private file boundaries.

import { cache } from 'react'

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

// Resolve the singleton once per request via `React.cache` (the
// `vercel-react-best-practices/server-cache-react` rule). The underlying
// `ContentCatalog.get()` is already a process-wide singleton — wrapping it
// with `cache()` is therefore a no-op on the cold path, but it gives every
// in-render call site (loaders, child resource routes, MDX components) the
// same identity-stable promise, which lets the SSR pass dedupe transparently
// even if catalog hydration ever becomes per-request (e.g. preview drafts).
export const getCatalog = cache(() => ContentCatalog.get())
