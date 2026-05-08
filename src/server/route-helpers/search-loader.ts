import { redirect } from 'react-router'

import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'

import { getClientPostsWithMetadata, getPostsBySlugs } from '@/server/posts/query'
import { listingSeo } from '@/server/route-helpers/listing-seo'
import { parseListingPage } from '@/server/route-helpers/pagination'
import { pagePath, searchRootPath } from '@/server/route-helpers/paths'
import { searchPostOptions, searchPosts } from '@/server/search'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { toClientPost, toListingPostCard } from '@/shared/catalog'

export interface SearchLoaderOptions {
  keyword: string | undefined
  num: string | undefined
  forceNoindex?: boolean
}
export async function searchLoader({
  keyword,
  num,
  forceNoindex = true,
}: SearchLoaderOptions): Promise<ListingPageLoaderData> {
  const listingNowIso = new Date().toISOString()
  const query = keyword?.trim() ?? ''
  if (query === '') {
    throw redirect('/')
  }
  const rootPath = searchRootPath(query)
  const pageNum = parseListingPage(num, rootPath)
  const pageSize = requireBlogSettingsSection('content').pagination.search
  const { hits, page, totalPages } = await searchPosts(query, pageSize, (pageNum - 1) * pageSize)
  if (num !== undefined) {
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
    forceNoindex,
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
