import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { FriendsView } from '@/ui/admin/friends/FriendsView'

import type { Route } from './+types/wp-admin.friends'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '友链管理' }, bundleFromMatches(matches))
}

export default function WpAdminFriendsRoute() {
  return <FriendsView />
}
