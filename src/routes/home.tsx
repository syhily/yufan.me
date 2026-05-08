import type { ListingPostCard } from '@/server/catalog'
import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'
import type { SidebarData } from '@/ui/sidebar/Sidebar'

import { getCatalog, toListingPostCard } from '@/server/catalog'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { metaWithFallback } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { selectFeaturePosts, selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'
import { requireBlogSettingsSection } from '@/shared/blog-config'
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

  // Home opts into the tail-merge guard so a near-empty last page never
  // renders alone with one or two cards stranded under the hero — the
  // visual rhythm of the grid breaks down at that count and the empty
  // sidebar gutter looks broken. With threshold = pageSize - 2 a tail
  // of pageSize - 3 or fewer posts collapses into the previous page;
  // any orphan stub of pageSize - 2 or larger keeps its own page.
  // Out-of-range :num still 301-redirects to the new last page through
  // the shared overflow handler in `redirectListingOverflow`.
  const homePageSize = requireBlogSettingsSection('content').pagination.posts
  const mergeTailWhenLessThan = Math.max(0, homePageSize - 2)

  return listingLoader<HomeExtra>({
    rawNum: params.num,
    posts: allPosts.map(toListingPostCard),
    rootPath: '/',
    pageSize: homePageSize,
    mergeTailWhenLessThan,
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

      const featureSeed = formatLocalDate(new Date(), 'yyyy-MM-dd', requireBlogSettingsSection('siteIdentity'))
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

export function meta({ loaderData, matches }: Route.MetaArgs) {
  // Page 1 ships `seo: []` so the home view stays as light as possible;
  // `metaWithFallback` reaches into the root match to hydrate the
  // shared snapshot before falling back to the site-default tags.
  return metaWithFallback({ loaderData, matches })
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
