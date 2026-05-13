import { redirect } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { PagesView } from '@/ui/admin/pages/PagesView'

import type { Route } from './+types/wp-admin.pages'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') throw redirect('/wp-admin/welcome')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '页面管理' }, bundleFromMatches(matches))
}

export default function WpAdminPagesRoute() {
  return <PagesView />
}
