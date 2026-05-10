import { redirect } from 'react-router'

import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'

import { getPostsBySlugs, toClientPost, toListingPostCard, getClientPostsWithMetadata } from '@/server/catalog'
import { listingSeo } from '@/server/route-helpers/listing-seo'
import { parseListingPage } from '@/server/route-helpers/pagination'
import { pagePath, searchRootPath } from '@/server/route-helpers/paths'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { searchPostOptions, searchPosts } from '@/server/search'
import { metaWithFallback } from '@/server/seo/meta'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { PostListingBody } from '@/ui/post/post/PostListViews'

import type { Route } from './+types/search.list'

export async function loader({ params }: Route.LoaderArgs): Promise<ListingPageLoaderData> {
  const listingNowIso = new Date().toISOString()
  const query = params.keyword?.trim() ?? ''
  if (query === '') {
    throw redirect('/')
  }

  const rootPath = searchRootPath(query)
  const pageNum = parseListingPage(params.num, rootPath)

  const pageSize = requireBlogSettingsSection('content').pagination.search
  const { hits, page, totalPages } = await searchPosts(query, pageSize, (pageNum - 1) * pageSize)

  if (params.num !== undefined) {
    if (totalPages === 0) {
      throw redirect('/', { status: 302 })
    }
    if (pageNum > totalPages) {
      throw redirect(pagePath(rootPath, totalPages))
    }
  }

  const posts = (await getPostsBySlugs(hits, searchPostOptions())).map((p) => toListingPostCard(toClientPost(p)))
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
    listingNowIso,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return metaWithFallback({ loaderData, matches })
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
      listingNowIso={loaderData.listingNowIso}
    />
  )
}
