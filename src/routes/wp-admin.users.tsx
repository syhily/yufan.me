import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { UsersView } from '@/ui/admin/users/UsersView'

import type { Route } from './+types/wp-admin.users'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户管理' }, bundleFromMatches(matches))
}

export default function WpAdminUsersRoute() {
  return <UsersView />
}
