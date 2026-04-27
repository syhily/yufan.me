import { getCatalog } from '@/server/catalog'
import { listingHeaders, listingShouldRevalidate } from '@/server/listing'
import { routeMeta } from '@/server/seo/meta'
import { CategoriesBody } from '@/ui/post/categories/CategoriesBody'
import { SectionErrorView } from '@/ui/primitives/SectionErrorView'

import type { Route } from './+types/categories'

export async function loader(_: Route.LoaderArgs) {
  const catalog = await getCatalog()
  return {
    categories: catalog.categoriesByCount,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = listingShouldRevalidate

export function meta() {
  return routeMeta({ title: '分类' })
}

export default function CategoriesRoute({ loaderData }: Route.ComponentProps) {
  return <CategoriesBody title="分类" categories={loaderData.categories} />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载分类列表" />
}
