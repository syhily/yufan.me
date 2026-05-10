import { listAllCategories } from '@/server/catalog'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { CategoriesBody } from '@/ui/post/categories/CategoriesBody'

import type { Route } from './+types/categories'

export async function loader(_: Route.LoaderArgs) {
  const categories = await listAllCategories()
  return {
    categories,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '分类' }, bundleFromMatches(matches))
}

export default function CategoriesRoute({ loaderData }: Route.ComponentProps) {
  return <CategoriesBody title="分类" categories={loaderData.categories} />
}
