import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'
import type { SidebarData } from '@/ui/sidebar/Sidebar'

import { getCategoryLinks, listAllTags } from '@/server/catalog'
import { selectFeaturePosts, selectSidebarPosts } from '@/server/posts/query'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { metaWithFallback } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { selectSidebarTags } from '@/server/sidebar/select'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { formatLocalDate } from '@/shared/formatter'
import { HomeLayoutBody } from '@/ui/post/post/PostListViews'

import type { Route } from './+types/home'

interface HomeExtra {
  categoryLinks: Record<string, string>
  featurePosts: import('@/shared/catalog').ListingPostCard[]
  admin: boolean
  sidebar: SidebarData
}

export async function loader({
  request,
  context,
  params,
}: Route.LoaderArgs): Promise<ListingPageLoaderData<HomeExtra>> {
  const { session } = getRouteRequestContext({ request, context })

  const content = requireBlogSettingsSection('content')
  const homePageSize = content.pagination.posts
  const mergeTailWhenLessThan = Math.max(0, homePageSize - 2)

  const { listPublicPostCardsPaginated, countPublicPosts } = await import('@/server/posts/query')
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
        admin: sidebar.admin,
        sidebar: {
          posts: await sidebarPostsPromise,
          tags: selectSidebarTags(tags),
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
      listingNowIso={loaderData.listingNowIso}
    />
  )
}
