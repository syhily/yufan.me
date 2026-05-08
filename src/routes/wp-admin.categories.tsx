import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { CategoriesView } from '@/ui/admin/categories/CategoriesView'

import type { Route } from './+types/wp-admin.categories'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '分类管理' }, bundleFromMatches(matches))
}

export default function WpAdminCategoriesRoute() {
  return <CategoriesView />
}
