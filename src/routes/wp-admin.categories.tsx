import { redirect } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { CategoriesView } from '@/ui/admin/categories/CategoriesView'

import type { Route } from './+types/wp-admin.categories'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') throw redirect('/wp-admin/welcome')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '分类管理' }, bundleFromMatches(matches))
}

export default function WpAdminCategoriesRoute() {
  return <CategoriesView />
}
