import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { UsersView } from '@/ui/admin/users/UsersView'

import type { Route } from './+types/wp-admin.users'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户管理' }, bundleFromMatches(matches))
}

export default function WpAdminUsersRoute() {
  return <UsersView />
}
