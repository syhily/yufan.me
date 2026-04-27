import config from '@/blog.config'
import { getCatalog, toListingPostCard } from '@/server/catalog'
import { listingHeaders, listingLoader, listingShouldRevalidate } from '@/server/listing'
import { notFound } from '@/server/route-helpers/http'
import { routeMeta } from '@/server/seo/meta'
import { PostListingBody } from '@/ui/post/post/PostListViews'
import { SectionErrorView } from '@/ui/primitives/SectionErrorView'

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
export const shouldRevalidate = listingShouldRevalidate

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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载分类" retryHref="/categories" retryLabel="返回分类列表" />
}
