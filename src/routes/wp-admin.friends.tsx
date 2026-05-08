import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/present/seo/meta'
import { FriendsView } from '@/ui/admin/friends/FriendsView'

import type { Route } from './+types/wp-admin.friends'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '友链管理' }, bundleFromMatches(matches))
}

export default function WpAdminFriendsRoute() {
  return <FriendsView />
}
