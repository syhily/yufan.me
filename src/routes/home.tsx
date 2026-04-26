import type { ListingPostCard } from '@/server/catalog'
import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'
import type { SidebarData } from '@/ui/sidebar/Sidebar'

import { getCatalog, toListingPostCard } from '@/server/catalog'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { selectFeaturePosts, selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'
import { formatLocalDate } from '@/shared/formatter'
import { HomeLayoutBody } from '@/ui/post/post/PostListViews'

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
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData || loaderData.seo.length === 0) return routeMeta()
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
