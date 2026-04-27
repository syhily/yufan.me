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
import { HomeLayoutBody } from '@/ui/post/post/PostListViews'
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
 * Client-side loader that overlays the cached sidebar snapshot on top of
 * the server's response. The server still ships the canonical sidebar
 * payload in the SSR HTML and on every navigation that misses the
 * cache; `clientLoader` lets us serve the cached value from Cache
 * Storage instead so back-to-home navigations skip the latest-comments
 * lookup. We always write the freshest data back to the cache so the
 * next navigation gets the new admin status / pending comments without
 * waiting for the TTL to expire. Defer-style background revalidation is
 * handled by `getSidebarSnapshot` itself when the entry is older than
 * the staleness threshold.
 */
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const serverData = await serverLoader()

  // Background-write the freshest sidebar to Cache Storage so the next
  // navigation can short-circuit. `void`-discarded — the navigation
  // shouldn't wait on a quota check.
  void writeSidebarSnapshotCache({
    admin: serverData.extra.admin,
    recentComments: serverData.extra.sidebar.recentComments,
    pendingComments: serverData.extra.sidebar.pendingComments,
  })

  // Cached value wins (matches the freshest user-visible state when the
  // server didn't see a new comment yet, e.g. after the user just
  // approved one in another tab). On a cache miss we fall through to the
  // server payload, which is what every fresh load already gets.
  let cached: Awaited<ReturnType<typeof getSidebarSnapshot>> | null = null
  try {
    cached = await getSidebarSnapshot()
  } catch {
    cached = null
  }

  if (!cached) {
    return serverData
  }

  return {
    ...serverData,
    extra: {
      ...serverData.extra,
      admin: cached.admin,
      sidebar: {
        ...serverData.extra.sidebar,
        recentComments: cached.recentComments,
        pendingComments: cached.pendingComments,
      },
    },
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData || loaderData.seo.length === 0) {
    return routeMeta()
  }
  return loaderData.seo
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  const { pageNum, totalPage, resolvedPosts, extra } = loaderData
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载首页" />
}
