import { requireAdmin } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { FriendsView } from '@/ui/admin/friends/FriendsView'

import type { Route } from './+types/wp-admin.friends'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '友链管理' }, bundleFromMatches(matches))
}

export default function WpAdminFriendsRoute() {
  return <FriendsView />
}
