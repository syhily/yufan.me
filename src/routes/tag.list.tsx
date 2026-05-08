import type { ListingPageLoaderData } from '@/server/present/router/listing-loader'

import { findTagBySlug } from '@/server/catalog/queries'
import { countPublicPosts, listPublicPostCardsPaginated } from '@/server/content/posts/query'
import { notFound } from '@/server/present/response/http'
import { listingLoader } from '@/server/present/router/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/present/router/route-exports'
import { metaWithFallback } from '@/server/present/seo/meta'
import { PostListingBody } from '@/ui/public/post/PostListViews'

import type { Route } from './+types/tag.list'

export async function loader({ params }: Route.LoaderArgs): Promise<ListingPageLoaderData> {
  const tag = await findTagBySlug(params.slug)
  if (!tag) {
    notFound()
  }

  const rootPath = `/tags/${tag.slug}`

  return listingLoader({
    rawNum: params.num,
    totalPosts: await countPublicPosts({ includeHidden: true, includeScheduled: false, tag: tag.name }),
    fetchPage: (pageNum, pageSize) =>
      listPublicPostCardsPaginated(pageNum, pageSize, {
        includeHidden: true,
        includeScheduled: false,
        tag: tag.name,
      }).then((r) => r.posts),
    rootPath,
    metadata: { likes: true, views: true, comments: false },
    title: tag.name,
    extra: undefined,
  })
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return metaWithFallback({ loaderData, matches })
}

export default function TagListRoute({ loaderData }: Route.ComponentProps) {
  return (
    <PostListingBody
      title={loaderData.title ?? ''}
      resolvedPosts={loaderData.resolvedPosts}
      pageNum={loaderData.pageNum}
      totalPage={loaderData.totalPage}
      rootPath={loaderData.rootPath}
      listingNowIso={loaderData.listingNowIso}
    />
  )
}
