import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'
import type { SidebarData } from '@/ui/public/Sidebar'

import { trackAccess } from '@/server/analytics/track'
import { getCategoryLinks, listAllTags } from '@/server/catalog/queries'
import {
  countPublicPosts,
  listPublicPostCardsPaginated,
  selectFeaturePosts,
  selectSidebarPosts,
} from '@/server/posts/query'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { metaWithFallback } from '@/server/seo/meta'
import { getRouteRequestContext, userSession } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { selectSidebarTags } from '@/server/sidebar/select'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { formatLocalDate } from '@/shared/formatter'
import { HomeLayoutBody } from '@/ui/public/post/PostListViews'

import type { Route } from './+types/home'

interface HomeExtra {
  categoryLinks: Record<string, string>
  featurePosts: import('@/shared/catalog').ListingPostCard[]
  sidebar: SidebarData
}

export async function loader({
  request,
  context,
  params,
}: Route.LoaderArgs): Promise<ListingPageLoaderData<HomeExtra>> {
  const { session } = getRouteRequestContext({ request, context })

  // Time-series access-log write for the analytics dashboard. The
  // homepage isn't a content detail page so we pass a null target —
  // the row still counts toward visits / visitors / referers.
  // Skip when the visitor is an admin (mirrors the post / page
  // detail loader's admin-exemption) so the dashboard owner doesn't
  // pollute their own visitor metrics.
  if (userSession(session)?.role !== 'admin') {
    void trackAccess(request, null)
  }

  const content = requireBlogSettingsSection('content')
  const homePageSize = content.pagination.posts
  const mergeTailWhenLessThan = Math.max(0, homePageSize - 2)

  const filters = {
    includeHidden: false,
    includeScheduled: import.meta.env.DEV,
  }

  const [totalPosts, sidebar, featureSeed] = await Promise.all([
    countPublicPosts(filters),
    loadSidebarData(session),
    Promise.resolve(formatLocalDate(new Date(), 'yyyy-MM-dd', requireBlogSettingsSection('siteIdentity'))),
  ])

  // Kick off independent queries in parallel with the listing pipeline.
  const featurePromise = selectFeaturePosts(featureSeed)
  const sidebarPostsPromise = selectSidebarPosts(requireBlogSettingsSection('sidebar').sidebar.post)
  const tagsPromise = listAllTags()

  return listingLoader<HomeExtra>({
    rawNum: params.num,
    totalPosts,
    fetchPage: (pageNum, pageSize) =>
      listPublicPostCardsPaginated(pageNum, pageSize, {
        ...filters,
        offset: (pageNum - 1) * homePageSize,
      }).then((r) => r.posts),
    rootPath: '/',
    pageSize: homePageSize,
    mergeTailWhenLessThan,
    metadata: { likes: true, views: true, comments: true },
    seoMode: 'skip-on-first-page',
    computeExtra: async ({ resolvedPosts }) => {
      const uniqueCategories = [...new Set(resolvedPosts.map((p) => p.category).filter(Boolean))]
      const [categoryLinks, featurePosts, tags] = await Promise.all([
        getCategoryLinks(uniqueCategories),
        featurePromise,
        tagsPromise,
      ])

      return {
        categoryLinks,
        featurePosts: featurePosts.map((post) => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          cover: post.cover,
          coverThumbhash: post.coverThumbhash,
          permalink: post.permalink,
          category: post.category,
          date: post.date,
          published: post.published,
        })),
        sidebar: {
          posts: await sidebarPostsPromise,
          tags: selectSidebarTags(tags),
          recentComments: sidebar.recentComments,
        },
      }
    },
  })
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData, matches }: Route.MetaArgs) {
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
      sidebar={extra.sidebar}
      listingNowIso={loaderData.listingNowIso}
    />
  )
}
