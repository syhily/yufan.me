import { getCatalog } from '@/server/catalog'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta } from '@/server/seo/meta'
import { CategoriesBody } from '@/ui/post/categories/CategoriesBody'

import type { Route } from './+types/categories'

export async function loader(_: Route.LoaderArgs) {
  const catalog = await getCatalog()
  return {
    categories: catalog.categoriesByCount,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta() {
  return routeMeta({ title: '分类' })
}

export default function CategoriesRoute({ loaderData }: Route.ComponentProps) {
  return <CategoriesBody title="分类" categories={loaderData.categories} />
}
