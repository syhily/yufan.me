import config from '@/blog.config'
import { getCatalog, toListingPostCard } from '@/server/catalog'
import { notFound } from '@/server/route-helpers/http'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta } from '@/server/seo/meta'
import { PostListingBody } from '@/ui/post/post/PostListViews'

import type { Route } from './+types/tag.list'

export async function loader({ params }: Route.LoaderArgs) {
  const catalog = await getCatalog()
  const tag = catalog.getTagBySlug(params.slug)
  if (!tag) notFound()

  const posts = catalog
    .getPostsByTaxonomy({ tagName: tag.name }, { includeHidden: true, includeScheduled: false })
    .map((post) => toListingPostCard(catalog.toClientPost(post)))
  return listingLoader({
    rawNum: params.num,
    posts,
    rootPath: tag.permalink,
    title: `标签 “${tag.name}”`,
    pageSize: config.settings.pagination.tags,
  })
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData?.seo ?? routeMeta()
}

export default function TagListRoute({ loaderData }: Route.ComponentProps) {
  return (
    <PostListingBody
      title={loaderData.title ?? ''}
      resolvedPosts={loaderData.resolvedPosts}
      pageNum={loaderData.pageNum}
      totalPage={loaderData.totalPage}
      rootPath={loaderData.rootPath}
    />
  )
}
