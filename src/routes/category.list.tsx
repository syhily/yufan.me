import { getCatalog, toListingPostCard } from '@/server/catalog'
import { notFound } from '@/server/route-helpers/http'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { metaWithFallback } from '@/server/seo/meta'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { PostListingBody } from '@/ui/post/post/PostListViews'

import type { Route } from './+types/category.list'

export async function loader({ params }: Route.LoaderArgs) {
  const catalog = await getCatalog()
  const category = catalog.getCategoryBySlug(params.slug)
  if (!category) {
    notFound()
  }

  const posts = catalog
    .getPostsByTaxonomy({ categoryName: category.name }, { includeHidden: true, includeScheduled: false })
    .map((post) => toListingPostCard(catalog.toClientPost(post)))
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const content = requireBlogSettingsSection('content')
  return listingLoader({
    rawNum: params.num,
    posts,
    rootPath: category.permalink,
    title: category.name,
    description: category.description,
    pageSize: content.pagination.category,
    feedLinks: {
      rss: `${category.permalink}/feed`,
      atom: `${category.permalink}/feed/atom`,
      title: `${siteIdentity.title} » 分类 “${category.name}”`,
    },
  })
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return metaWithFallback({ loaderData, matches })
}

export default function CategoryListRoute({ loaderData }: Route.ComponentProps) {
  return (
    <PostListingBody
      title={loaderData.title ?? ''}
      description={loaderData.description}
      resolvedPosts={loaderData.resolvedPosts}
      pageNum={loaderData.pageNum}
      totalPage={loaderData.totalPage}
      rootPath={loaderData.rootPath}
    />
  )
}
