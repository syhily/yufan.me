import type { ListingPageLoaderData } from '@/server/route-helpers/listing-loader'

import { findTagBySlug } from '@/server/catalog/queries'
import { countPublicPosts, listPublicPostCardsPaginated } from '@/server/posts/query'
import { notFound } from '@/server/route-helpers/http'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { metaWithFallback } from '@/server/seo/meta'
import { PostListingBody } from '@/ui/post/post/PostListViews'

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
