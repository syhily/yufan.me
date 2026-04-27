// Detail-route shell shared by `posts/:slug` and `:slug` (page) routes.
// Mirrors `@/server/listing.ts` so each detail route stays ~30 lines:
//
//   - `loadPublicDetailData`: resolve the streaming detail payload (the
//     critical block + a deferred `comments` promise) plus the optional
//     sidebar projection.
//   - `requireDetailSource`: 404 helper for unknown slugs.
//   - `redirectPermanent`: 301 helper for canonical redirects.
//   - `canonicalPostPath`: detect when a post was fetched via an alias and
//     compute the canonical `/posts/<slug>`.
//   - `detailHeaders`: cache-control profile for detail HTML/data.
//   - `publicShouldRevalidate`: re-export from `@/server/listing` so detail
//     and listing routes share the same comment-action revalidation rule.
//
// `preloadPostBody` lives in `@/ui/mdx/MdxContent` (next to the matching
// `PostBody` component) and is intentionally NOT re-exported here. Server
// modules must not import from `ui/*`, so detail routes spell out two
// imports: one from `@/server/detail` for the loader/policy surface and
// one from `@/ui/mdx/MdxContent` for the MDX body bridge.

import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import type { ClientPost, ClientTag } from '@/server/catalog'
import type { DetailPageComments, loadDetailPageStreaming } from '@/server/comments/page-data'
import type { selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'

import { listingShouldRevalidate } from '@/server/listing'
import { cacheHeaders } from '@/server/route-helpers/headers'
import { notFound } from '@/server/route-helpers/http'
import { getRouteRequestContext } from '@/server/session'

// `loadDetailPageStreaming` and `selectSidebarPosts/Tags` transitively
// import `@/server/catalog`, which eagerly pulls Fumadocs' YAML glob.
// Vitest doesn't load the Fumadocs Vite plugin, so a top-level runtime
// import would crash every test that just wants to verify
// `canonicalPostPath` or `redirectPermanent`. Lazy-resolve the runtime
// functions inside `loadPublicDetailData` so the pure helpers stay
// test-friendly. Types are imported directly above (type-only imports
// are erased at compile time and never trigger the YAML loader). The
// dynamic specifiers match the ones route modules use so
// `vi.mock('@/server/comments/page-data', …)` and
// `vi.mock('@/server/sidebar/select', …)` still intercept them.
async function loadDetailRuntime(): Promise<{
  loadDetailPageStreaming: typeof loadDetailPageStreaming
  selectSidebarPosts: typeof selectSidebarPosts
  selectSidebarTags: typeof selectSidebarTags
}> {
  const [comments, sidebar] = await Promise.all([
    import('@/server/comments/page-data'),
    import('@/server/sidebar/select'),
  ])
  return {
    loadDetailPageStreaming: comments.loadDetailPageStreaming,
    selectSidebarPosts: sidebar.selectSidebarPosts,
    selectSidebarTags: sidebar.selectSidebarTags,
  }
}

// ---------------------------------------------------------------------------
// Path / redirect helpers
// ---------------------------------------------------------------------------

// When a post is fetched via one of its aliases, return the canonical
// `/posts/<slug>` so the route can issue a 301 redirect. Returns
// `undefined` when the requested slug is already the canonical one (no
// redirect needed).
export function canonicalPostPath(requestedSlug: string | undefined, canonicalSlug: string): string | undefined {
  return requestedSlug !== undefined && requestedSlug !== canonicalSlug ? `/posts/${canonicalSlug}` : undefined
}

export function requireDetailSource<T>(source: T | undefined): T {
  if (source === undefined) {
    notFound()
  }
  return source
}

export function redirectPermanent(location: string): never {
  throw redirect(location, { status: 301 })
}

// ---------------------------------------------------------------------------
// Streaming detail-page loader
// ---------------------------------------------------------------------------

export type PublicDetailCritical = Awaited<ReturnType<typeof loadDetailPageStreaming>>['critical']

// `comments` rides as a Promise so the route can stream it through React
// 19's `use()` hook inside a `<Suspense>` boundary while the critical
// body renders.
export interface PublicDetailData extends PublicDetailCritical {
  comments: Promise<DetailPageComments>
}

export interface PublicDetailSidebarData {
  posts: ReturnType<typeof selectSidebarPosts>
  tags: ReturnType<typeof selectSidebarTags>
}

export async function loadPublicDetailData({
  request,
  context,
  permalink,
  title,
  preload,
  sidebar,
}: Pick<LoaderFunctionArgs, 'request' | 'context'> & {
  permalink: string
  title: string
  preload: () => Promise<void>
  sidebar?: {
    posts: ClientPost[]
    tags: ClientTag[]
  }
}): Promise<{ detail: PublicDetailData; sidebar?: PublicDetailSidebarData }> {
  const { session } = getRouteRequestContext({ request, context })
  const runtime = await loadDetailRuntime()
  const [, streaming] = await Promise.all([preload(), runtime.loadDetailPageStreaming(session, permalink, title)])

  return {
    detail: { ...streaming.critical, comments: streaming.comments },
    sidebar:
      sidebar === undefined
        ? undefined
        : {
            posts: runtime.selectSidebarPosts(sidebar.posts),
            tags: runtime.selectSidebarTags(sidebar.tags),
          },
  }
}

// ---------------------------------------------------------------------------
// Route-module exports (`headers`, `shouldRevalidate`, `preloadPostBody`)
// ---------------------------------------------------------------------------

// Detail pages: post.detail, page.detail. Longer SWR window than listings
// since the body content rarely changes between visits.
export const detailHeaders: HeadersFunction = cacheHeaders('detail')

// Detail and listing routes share the comment-action revalidation rule.
// Re-exporting from a single source so the policy can't drift.
export const publicShouldRevalidate = listingShouldRevalidate
