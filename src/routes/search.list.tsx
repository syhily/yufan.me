import { redirect } from 'react-router'

import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'

import config from '@/blog.config'
import { getCatalog, getClientPostsWithMetadata, toListingPostCard } from '@/server/catalog'
import { listingSeo } from '@/server/route-helpers/listing-seo'
import { parseListingPage } from '@/server/route-helpers/pagination'
import { pagePath, searchRootPath } from '@/server/route-helpers/paths'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { searchPostOptions, searchPosts } from '@/server/search'
import { routeMeta } from '@/server/seo/meta'
import { PostListingBody } from '@/ui/post/post/PostListViews'

import type { Route } from './+types/search.list'

export async function loader({ params }: Route.LoaderArgs): Promise<ListingPageLoaderData> {
  const query = params.keyword?.trim() ?? ''
  if (query === '') {
    throw redirect('/')
  }

  const rootPath = searchRootPath(query)
  const pageNum = parseListingPage(params.num, rootPath)

  const pageSize = config.settings.pagination.search
  const { hits, page, totalPages } = await searchPosts(query, pageSize, (pageNum - 1) * pageSize)

  // Search uses its own pagination shape (FlexSearch returns the total page
  // count up front), so we hand-roll the overflow/empty redirects rather
  // than calling `redirectListingOverflow` (which expects a single page
  // number and treats `totalPage === 0` as a 404). For search we always
  // redirect home on empty results to preserve the historical UX.
  if (params.num !== undefined) {
    if (totalPages === 0) throw redirect('/', { status: 302 })
    if (pageNum > totalPages) throw redirect(pagePath(rootPath, totalPages))
  }

  const catalog = await getCatalog()
  const posts = catalog
    .getPostsBySlugs(hits, searchPostOptions())
    .map((p) => toListingPostCard(catalog.toClientPost(p)))
  const resolvedPosts = await getClientPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })

  const title = `【${query}】搜索结果`
  const seo = listingSeo({
    title,
    pageNum: page,
    totalPage: totalPages,
    rootPath,
    forceNoindex: true,
  })

  return {
    pageNum: page,
    totalPage: totalPages,
    rootPath,
    resolvedPosts,
    title,
    seo,
    extra: undefined,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData?.seo ?? routeMeta()
}

export default function SearchListRoute({ loaderData }: Route.ComponentProps) {
  return (
    <PostListingBody
      title={loaderData.title ?? ''}
      resolvedPosts={loaderData.resolvedPosts}
      pageNum={loaderData.pageNum}
      totalPage={loaderData.totalPage}
      rootPath={loaderData.rootPath}
      alwaysRenderPagination={false}
    />
  )
}
