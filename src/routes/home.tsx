import type { MetaDescriptor } from 'react-router'

import { Suspense, use } from 'react'

import type { SidebarSnapshotOutput } from '@/client/api/action-types'
import type { ListingPostCard } from '@/server/catalog'
import type { ListingPageLoaderData } from '@/server/listing'
import type { SidebarData } from '@/ui/sidebar/Sidebar'

import { getSidebarSnapshot, writeSidebarSnapshotCache } from '@/client/sidebar/cache'
import { getCatalog, toListingPostCard } from '@/server/catalog'
import { listingHeaders, listingLoader, listingShouldRevalidate } from '@/server/listing'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { selectFeaturePosts, selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'
import { formatLocalDate } from '@/shared/formatter'
import { HomeLayoutBody, HomeListingSkeleton } from '@/ui/post/post/HomeLayoutBody'
import { SectionErrorView } from '@/ui/primitives/SectionErrorView'

import type { Route } from './+types/home'

interface HomeExtra {
  categoryLinks: Record<string, string>
  featurePosts: ListingPostCard[]
  admin: boolean
  sidebar: SidebarData
}

export async function loader({
  request,
  context,
  params,
}: Route.LoaderArgs): Promise<ListingPageLoaderData<HomeExtra>> {
  const { session } = getRouteRequestContext({ request, context })
  const catalog = await getCatalog()
  const allPosts = catalog.getClientPosts({
    includeHidden: false,
    includeScheduled: import.meta.env.DEV,
  })

  // Sidebar fetch is independent of post pagination, so kick it off in
  // parallel with the listing pipeline. The sidebar reads the in-process
  // recent-comment cache + Redis admin flag — both bounded — so the parallel
  // path is the historical hot path.
  const sidebarPromise = loadSidebarData(session)

  return listingLoader<HomeExtra>({
    rawNum: params.num,
    posts: allPosts.map(toListingPostCard),
    rootPath: '/',
    metadata: { likes: true, views: true, comments: true },
    seoMode: 'skip-on-first-page',
    computeExtra: async ({ resolvedPosts }) => {
      // One-pass: every post needs a category breadcrumb chip; pull the
      // permalink from the catalog's pre-computed name → permalink Map
      // instead of round-tripping through a Set + getCategoriesByName.
      const categoryLinks: Record<string, string> = {}
      for (const post of resolvedPosts) {
        if (categoryLinks[post.category] === undefined) {
          categoryLinks[post.category] = catalog.getCategoryLink(post.category)
        }
      }

      const featureSeed = formatLocalDate(new Date(), 'yyyy-MM-dd')
      const sidebar = await sidebarPromise
      return {
        categoryLinks,
        featurePosts: selectFeaturePosts(allPosts, featureSeed).map(toListingPostCard),
        admin: sidebar.admin,
        sidebar: {
          posts: selectSidebarPosts(allPosts),
          tags: selectSidebarTags(catalog.tags),
          recentComments: sidebar.recentComments,
          pendingComments: sidebar.pendingComments,
        },
      }
    },
  })
}

export const headers = listingHeaders
export const shouldRevalidate = listingShouldRevalidate

/**
 * Loader-data shape emitted by `clientLoader`. Two variants:
 *
 *   - `sync` — the cache was empty (first SPA navigation, hard reload, or
 *     a sign-in/out invalidation). The server response has been awaited
 *     and every field is ready to render synchronously, matching the
 *     plain `loader()` shape.
 *   - `swr` — the cache had a fresh sidebar snapshot. We render
 *     immediately with the cached `admin/sidebar` slice and stream the
 *     rest of the listing through `fresh`. The route component reads
 *     `fresh` via `use()` inside a `<Suspense>` boundary that wraps the
 *     post-grid only, so first paint is not blocked on the server's
 *     `getCatalog().getClientPostsWithMetadata(...)` call.
 *
 * Both variants carry `seo: MetaDescriptor[]` at the top level so
 * `meta()` (server-direct, sync, swr) can read it via the same key —
 * the discriminated union no longer leaks into route metadata. For the
 * `swr` branch the array is always empty because that branch only fires
 * for the default `/` URL (no `num` param) and `seoMode:
 * 'skip-on-first-page'` makes the server-side seo empty there too —
 * keeping the contract explicit instead of implicit.
 *
 * This implements `react-router-framework-mode/loader-defer` plus the
 * stale-while-revalidate rule from the project's
 * `client/sidebar/cache.ts` documentation.
 */
type ServerHomeData = ListingPageLoaderData<HomeExtra>

type HomeLoaderData =
  | { kind: 'sync'; seo: MetaDescriptor[]; data: ServerHomeData }
  | { kind: 'swr'; seo: MetaDescriptor[]; cached: SidebarSnapshotOutput; fresh: Promise<ServerHomeData> }

/**
 * Client-side loader. Implements stale-while-revalidate against the
 * sidebar Cache Storage entry (`client/sidebar/cache.ts`). On a cache
 * hit we render immediately with the cached sidebar slice and let the
 * server response upgrade the post grid (and any post-tied counters)
 * once it arrives — see the `swr` branch of `HomeLoaderData` above.
 *
 * The fire-and-forget cache write keeps the snapshot warm even when
 * the cached value already wins for sidebar so back-to-home navigations
 * always start from the latest admin / pending-comments view.
 */
export async function clientLoader({ serverLoader, params }: Route.ClientLoaderArgs): Promise<HomeLoaderData> {
  // Kick off the cache read and the server fetch in parallel so the
  // cache-hit branch never waits on the server, and the cache-miss
  // branch never waits on a no-op cache miss before starting the
  // server fetch.
  const cachePromise: Promise<SidebarSnapshotOutput | null> = getSidebarSnapshot().catch(() => null)
  const serverPromise: Promise<ServerHomeData> = serverLoader().then((serverData) => {
    // Background-write the freshest sidebar to Cache Storage so the
    // next navigation can short-circuit. Quota errors are swallowed
    // by `writeSidebarSnapshotCache`.
    void writeSidebarSnapshotCache({
      admin: serverData.extra.admin,
      recentComments: serverData.extra.sidebar.recentComments,
      pendingComments: serverData.extra.sidebar.pendingComments,
    })
    return serverData
  })

  // Page 2+ has listing-specific `<title>` / canonical / OpenGraph
  // tags that ride along on `loaderData.seo`. `meta()` runs once per
  // loader-data change, never against the deferred slice, so a SWR
  // payload would silently drop those tags. Restrict SWR to the
  // default `/` route (no paginated `num`) and always await the
  // server on `/page/N` so SEO stays accurate.
  if (params.num) {
    const data = await serverPromise
    return { kind: 'sync', seo: data.seo, data }
  }

  const cached = await cachePromise
  if (!cached) {
    // First paint / cache miss: wait for the canonical server payload
    // before rendering. Same behaviour as the pre-SWR design.
    const data = await serverPromise
    return { kind: 'sync', seo: data.seo, data }
  }

  // SWR branch only fires on the default `/` URL where `seoMode:
  // 'skip-on-first-page'` already produces an empty `seo` array, so we
  // hard-code that contract here instead of awaiting `serverPromise`
  // just to read its `.seo` field.
  return { kind: 'swr', seo: [], cached, fresh: serverPromise }
}

// Type guard between the server `loader()` shape (raw
// `ListingPageLoaderData`) and the `clientLoader()` discriminated union.
// React Router's `Route.ComponentProps['loaderData']` is the union of
// both — the route component still has to discriminate before touching
// any client-only fields, but `meta()` reads only `seo` and that field
// lives at the top level on every variant, so it can stay one-liner.
function isClientLoaderShape(value: unknown): value is HomeLoaderData {
  return typeof value === 'object' && value !== null && 'kind' in value
}

export function meta({ loaderData }: Route.MetaArgs) {
  // Both `loader()` (raw `ListingPageLoaderData`) and `clientLoader()`
  // (discriminated `sync` / `swr`) carry `seo` at the top level. The
  // server seoMode (`skip-on-first-page`) makes `seo` empty for the
  // default `/` route, where we fall through to `routeMeta()` for the
  // home-page defaults.
  const seo = loaderData?.seo
  return seo && seo.length > 0 ? seo : routeMeta()
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  // Server-rendered first request: `loaderData` is the raw server
  // shape, render synchronously. Same path as before SWR landed.
  if (!isClientLoaderShape(loaderData)) {
    return <HomeBody data={loaderData} />
  }
  // SPA navigation: discriminate the client-loader union. `sync`
  // means the cache missed and the server response was awaited, so
  // we can render synchronously. `swr` means the cache hit and we
  // hand the deferred server response to `<Suspense>` while the
  // cached sidebar slice paints immediately.
  if (loaderData.kind === 'sync') {
    return <HomeBody data={loaderData.data} />
  }
  return <HomeBodyDeferred cached={loaderData.cached} fresh={loaderData.fresh} />
}

function HomeBody({ data }: { data: ServerHomeData }) {
  const { pageNum, totalPage, resolvedPosts, extra } = data
  return (
    <HomeLayoutBody
      resolvedPosts={resolvedPosts}
      pageNum={pageNum}
      totalPage={totalPage}
      categoryLinks={extra.categoryLinks}
      featurePosts={extra.featurePosts}
      admin={extra.admin}
      sidebar={extra.sidebar}
    />
  )
}

interface HomeBodyDeferredProps {
  cached: SidebarSnapshotOutput
  fresh: Promise<ServerHomeData>
}

// Renders the listing inside a Suspense boundary so the cached sidebar
// can paint immediately while the server response hydrates the rest.
// Once `fresh` resolves, `HomeBody` swaps in with the canonical data —
// including the cache's freshest admin/sidebar slice, which keeps
// admin-only widgets (pending comments) accurate across tabs.
function HomeBodyDeferred({ cached, fresh }: HomeBodyDeferredProps) {
  return (
    <Suspense fallback={<HomeListingSkeleton cached={cached} />}>
      <HomeBodyResolved cached={cached} fresh={fresh} />
    </Suspense>
  )
}

function HomeBodyResolved({ cached, fresh }: HomeBodyDeferredProps) {
  const data = use(fresh)
  // The cache might be ahead of the server (admin just approved a
  // comment in another tab and the recent-comments cache hasn't
  // refreshed yet). Overlay the cached `admin/sidebar` slice on top
  // of the server payload so the user keeps seeing the freshest state.
  const merged: ServerHomeData = {
    ...data,
    extra: {
      ...data.extra,
      admin: cached.admin,
      sidebar: {
        ...data.extra.sidebar,
        recentComments: cached.recentComments,
        pendingComments: cached.pendingComments,
      },
    },
  }
  return <HomeBody data={merged} />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载首页" />
}
