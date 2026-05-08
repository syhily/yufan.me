import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/present/seo/meta'
import { PagesView } from '@/ui/admin/pages/PagesView'

import type { Route } from './+types/wp-admin.pages'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '页面管理' }, bundleFromMatches(matches))
}

export default function WpAdminPagesRoute() {
  return <PagesView />
}
