import { redirect } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { UsersView } from '@/ui/admin/users/UsersView'

import type { Route } from './+types/wp-admin.users'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') throw redirect('/wp-admin/welcome')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户管理' }, bundleFromMatches(matches))
}

export default function WpAdminUsersRoute() {
  return <UsersView />
}
