import config from '@/blog.config'
import { getCatalog, toListingPostCard } from '@/server/catalog'
import { notFound } from '@/server/route-helpers/http'
import { listingLoader } from '@/server/route-helpers/listing-loader'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta } from '@/server/seo/meta'
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
  return listingLoader({
    rawNum: params.num,
    posts,
    // Listing chrome consumes a plain string (the SEO `og:description`
    // and the `<PostListingBody>` description preview are still string
    // surfaces). The `<CategoriesBody>` cards are the only place that
    // currently renders the compiled MDX body.
    rootPath: category.permalink,
    title: category.name,
    description: category.description?.plain,
    pageSize: config.settings.pagination.category,
  })
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData?.seo ?? routeMeta()
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
