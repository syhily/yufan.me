import type { ListingPageLoaderData } from '@/server/present/router/listing-loader'

import { listingHeaders, publicShouldRevalidate } from '@/server/present/router/route-exports'
import { searchLoader } from '@/server/present/router/search-loader'
import { metaWithFallback } from '@/server/present/seo/meta'
import { PostListingBody } from '@/ui/public/post/PostListViews'

import type { Route } from './+types/search.list'

export async function loader({ params }: Route.LoaderArgs): Promise<ListingPageLoaderData> {
  return searchLoader({ keyword: params.keyword, num: params.num })
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
