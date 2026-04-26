import type { MetaDescriptor } from 'react-router'

import type { ListingPostCard, ListingPostCardWithMetadata } from '@/server/catalog'

import config from '@/blog.config'
import { getClientPostsWithMetadata } from '@/server/catalog'
import { listingSeo } from '@/server/route-helpers/listing-seo'
import { parseListingPage, redirectListingOverflow } from '@/server/route-helpers/pagination'
import { slicePosts } from '@/shared/formatter'

// Shared loader-return shape for every listing route (`/`, `/cats/:slug`,
// `/tags/:slug`, `/search/:keyword`). Components destructure the same fields
// regardless of which loader produced the data. `extra` is a per-route slot
// for sidebar/feature data that doesn't fit the generic listing contract.
export interface ListingPageLoaderData<TExtra = undefined> {
  pageNum: number
  totalPage: number
  rootPath: string
  resolvedPosts: ListingPostCardWithMetadata[]
  title?: string
  description?: string
  /** Pre-computed `MetaDescriptor[]` ready to return from `meta()`. */
  seo: MetaDescriptor[]
  extra: TExtra
}

// Per-page metadata fan-out. Defaults match the historical category/tag
// listing behaviour (likes + views, no comment count). Home overrides this
// to also pull comment counts (cards on `/` show the comment-bubble badge).
export interface ListingMetadataFlags {
  likes?: boolean
  views?: boolean
  comments?: boolean
}

const DEFAULT_LISTING_METADATA: Required<ListingMetadataFlags> = {
  likes: true,
  views: true,
  comments: false,
}

// Page-1 SEO behaviour. The historical category/tag listings always emit
// canonical/prev/next, but the home page deliberately skips SEO on page 1 so
// the most-visited URL ships the smallest possible MetaDescriptor payload
// (the root `meta()` already provides the site default).
export type ListingSeoMode = 'always' | 'skip-on-first-page'

// Listing routes (`/`, `/cats/:slug`, `/tags/:slug`) share the same loader
// skeleton: slice & resolve posts, redirect on overflow, and emit canonical/
// prev/next SEO. This helper centralises the pattern so each route only
// carries the params-to-filter mapping plus its body props.
//
// `extra` is computed via an optional async callback so the per-route work
// (sidebar / feature posts / category-link map) can run alongside the
// shared post-resolution pipeline without forcing every caller to duplicate
// the slice/hydrate dance.
//
// Lives in a `.server.ts` file so the SSR-only `session.server` / metadata
// imports never reach the client bundle.
export async function listingLoader<TExtra = undefined>({
  rawNum,
  posts,
  rootPath,
  title,
  description,
  pageSize,
  forceNoindex,
  metadata,
  seoMode = 'always',
  computeExtra,
  extra,
}: {
  rawNum: string | undefined
  posts: ListingPostCard[]
  rootPath: string
  title?: string
  description?: string
  pageSize?: number
  forceNoindex?: boolean
  metadata?: ListingMetadataFlags
  seoMode?: ListingSeoMode
  /**
   * Async callback that produces the per-route `extra` payload from the
   * resolved page slice. Runs after pagination/overflow redirects so the
   * caller only sees the in-page slice that will actually render.
   */
  computeExtra?: (args: ListingExtraArgs<ListingPostCardWithMetadata>) => Promise<TExtra> | TExtra
  /** Static extra payload, used when no async work is needed. */
  extra?: TExtra
}): Promise<ListingPageLoaderData<TExtra>> {
  const pageNum = parseListingPage(rawNum, rootPath)

  const { currentPosts, totalPage } = slicePosts(posts, pageNum, pageSize ?? config.settings.pagination.posts)
  const resolvedPosts = await getClientPostsWithMetadata(currentPosts, {
    ...DEFAULT_LISTING_METADATA,
    ...metadata,
  })

  redirectListingOverflow(rawNum, pageNum, totalPage, rootPath)

  const resolvedExtra: TExtra =
    computeExtra !== undefined ? await computeExtra({ resolvedPosts, pageNum, totalPage }) : (extra as TExtra)

  const seo =
    seoMode === 'skip-on-first-page' && pageNum === 1
      ? []
      : listingSeo({
          title,
          description,
          pageNum,
          totalPage,
          rootPath,
          forceNoindex,
        })

  return {
    pageNum,
    totalPage,
    rootPath,
    resolvedPosts,
    title,
    description,
    seo,
    extra: resolvedExtra,
  }
}

export interface ListingExtraArgs<TPost = ListingPostCardWithMetadata> {
  resolvedPosts: TPost[]
  pageNum: number
  totalPage: number
}
