// Listing-route shell shared by every public listing surface (`home`,
// `archives`, `cats/:slug`, `tags/:slug`, `search/:keyword`,
// `categories`).
//
// Combines five concerns that always travel together:
//   - `pagination`: parse `:num`, redirect overflow / `/page/1` collapse,
//     and build canonical `pagePath(rootPath, n)` URLs.
//   - `listingSeo`: precompute `MetaDescriptor[]` (canonical + prev/next +
//     noindex on /page/N>1) so the route's `meta()` becomes a one-liner.
//   - `listingLoader`: slice + hydrate posts with metadata, run the
//     per-route `extra` callback, and emit the standard
//     `ListingPageLoaderData<TExtra>` shape.
//   - `listingHeaders`: cache-control profile for listing HTML/data.
//   - `listingShouldRevalidate`: comment-action-aware revalidation policy
//     (a comment submission must not re-render the listing).
//
// Exported from this single module so the seven listing routes stay
// 15-30 lines each. Per the `bundle-barrel-imports` rule we don't add
// an `index.ts` re-export — every consumer imports directly from
// `@/server/listing`.

import type { HeadersFunction, MetaDescriptor, ShouldRevalidateFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import type { ListingPostCard, ListingPostCardWithMetadata } from '@/server/catalog'

import config from '@/blog.config'
import { cacheHeaders } from '@/server/route-helpers/headers'
import { notFound } from '@/server/route-helpers/http'
import { routeMeta } from '@/server/seo/meta'
import { API_ACTIONS } from '@/shared/api-actions'
import { slicePosts } from '@/shared/formatter'

// `getClientPostsWithMetadata` lives in `@/server/catalog`, which eagerly
// imports the Fumadocs `.source/server.ts` glob (and therefore the YAML
// metas). Vitest doesn't run the Fumadocs Vite plugin so a top-level
// import would crash every test that touches this module just to use the
// pure pagination/SEO helpers below. Lazy-resolve the runtime call inside
// `listingLoader` so test-only consumers (`pagePath`, `parsePageNum`,
// `listingSeo`, `listingShouldRevalidate`) never trip the YAML import.
// The dynamic import targets the same `@/server/catalog` specifier the
// route modules use so `vi.mock('@/server/catalog', …)` interceptors in
// route-level tests still apply.
async function loadCatalogPostMetadata() {
  const mod = await import('@/server/catalog')
  return mod.getClientPostsWithMetadata
}

// ---------------------------------------------------------------------------
// Pagination + canonical-URL helpers
// ---------------------------------------------------------------------------

// Build the canonical URL for page `pageNum` under `rootPath`. Page 1 of a
// listing is the bare root URL (no `/page/1` suffix) for canonical collapse.
export function pagePath(rootPath: string, pageNum: number): string {
  if (pageNum <= 1) {
    return rootPath
  }
  const pageRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return `${pageRoot}page/${pageNum}`
}

export function searchRootPath(query: string): string {
  return `/search/${encodeURIComponent(query)}`
}

// Raw `:num` URL param → integer. 404s when the segment isn't a numeric
// string (we never want `/page/abc` to silently match page 1). The regex
// guarantees `Number.parseInt` succeeds, so no follow-up NaN check is needed.
export function parsePageNum(raw: string | undefined): number {
  if (raw === undefined || raw === '' || !/^\d+$/.test(raw)) {
    notFound()
  }
  return Number.parseInt(raw, 10)
}

// Same as `parsePageNum` plus the canonical-collapse rule: `/page/1`
// redirects to the bare root (e.g. `/page/1` → `/`). Returns the parsed
// `pageNum` when the URL is the canonical one.
export function parseListingPage(raw: string | undefined, rootPath: string): number {
  const pageNum = raw === undefined ? 1 : parsePageNum(raw)
  if (raw !== undefined && pageNum <= 1) {
    throw redirect(rootPath)
  }
  return pageNum
}

// Bounds-check the requested page against the catalog's actual page count.
// Out-of-range pages redirect to the last valid page; an empty catalog 404s
// (we never serve a blank listing).
export function redirectListingOverflow(
  raw: string | undefined,
  pageNum: number,
  totalPage: number,
  rootPath: string,
): void {
  if (raw !== undefined && pageNum > totalPage && totalPage > 0) {
    throw redirect(pagePath(rootPath, totalPage))
  }
  if (totalPage === 0) {
    notFound()
  }
}

// ---------------------------------------------------------------------------
// Listing SEO meta-tag projection
// ---------------------------------------------------------------------------

export interface ListingSeoProps {
  title?: string
  description?: string
  pageNum: number
  totalPage: number
  rootPath: string
  forceNoindex?: boolean
}

// Produces the **complete** `MetaDescriptor[]` for a listing page in one
// call so loaders can ship the final tags over the wire. Each route's
// `meta()` then becomes a one-liner that returns
// `loaderData?.seo ?? routeMeta()`.
export function listingSeo({
  title,
  description,
  pageNum,
  totalPage,
  rootPath,
  forceNoindex = false,
}: ListingSeoProps): MetaDescriptor[] {
  let pageTitle = title
  if (pageNum > 1) {
    pageTitle = title === undefined ? `第 ${pageNum} 页` : `${title} · 第 ${pageNum} 页`
  }

  return routeMeta({
    title: pageTitle,
    description,
    pageUrl: pagePath(rootPath, pageNum),
    canonical: true,
    prevUrl: pageNum > 1 ? pagePath(rootPath, pageNum - 1) : undefined,
    nextUrl: pageNum < totalPage ? pagePath(rootPath, pageNum + 1) : undefined,
    noindex: forceNoindex || pageNum > 1,
  })
}

// ---------------------------------------------------------------------------
// Listing loader skeleton
// ---------------------------------------------------------------------------

// Shared loader-return shape for every listing route (`/`, `/cats/:slug`,
// `/tags/:slug`, `/search/:keyword`). Components destructure the same
// fields regardless of which loader produced the data. `extra` is a
// per-route slot for sidebar/feature data that doesn't fit the generic
// listing contract.
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
// canonical/prev/next, but the home page deliberately skips SEO on page 1
// so the most-visited URL ships the smallest possible MetaDescriptor
// payload (the root `meta()` already provides the site default).
export type ListingSeoMode = 'always' | 'skip-on-first-page'

export interface ListingExtraArgs<TPost = ListingPostCardWithMetadata> {
  resolvedPosts: TPost[]
  pageNum: number
  totalPage: number
}

// Listing routes (`/`, `/cats/:slug`, `/tags/:slug`) share the same loader
// skeleton: slice & resolve posts, redirect on overflow, and emit
// canonical/prev/next SEO. This helper centralises the pattern so each
// route only carries the params-to-filter mapping plus its body props.
//
// `extra` is computed via an optional async callback so the per-route work
// (sidebar / feature posts / category-link map) can run alongside the
// shared post-resolution pipeline without forcing every caller to
// duplicate the slice/hydrate dance.
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
  const getClientPostsWithMetadata = await loadCatalogPostMetadata()
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

// ---------------------------------------------------------------------------
// Route-module exports (`headers`, `shouldRevalidate`)
// ---------------------------------------------------------------------------

// Listing pages: home, archives, categories, /cats/:slug, /tags/:slug,
// /search/:keyword. Short browser cache + SWR window keeps per-post
// like/view counters fresh without another round-trip on back/forward
// navigations.
export const listingHeaders: HeadersFunction = cacheHeaders('listing')

const COMMENT_ACTION_PATHS: ReadonlySet<string> = new Set(
  Object.values(API_ACTIONS.comment).map((action) => action.path),
)

// Comment-action submissions must not re-render the listing — the comment
// island manages its own DOM updates and React Router would otherwise
// re-paint the same freshly-created comment a second time. Plain link
// navigations (`/page/2 → /page/3`) still revalidate because
// `defaultShouldRevalidate` is `true` for them.
export function listingShouldRevalidate({
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (isCommentAction(formAction)) {
    return false
  }
  return defaultShouldRevalidate
}

export function isCommentAction(formAction: string | undefined): boolean {
  const pathname = actionPathname(formAction)
  return pathname !== undefined && COMMENT_ACTION_PATHS.has(pathname)
}

function actionPathname(formAction: string | undefined): string | undefined {
  if (!formAction) {
    return undefined
  }
  try {
    return new URL(formAction, 'http://local.invalid').pathname
  } catch {
    const [pathname] = formAction.split('?')
    return pathname || undefined
  }
}
