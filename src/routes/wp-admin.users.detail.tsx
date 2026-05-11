import { useParams } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { UserDetailView } from '@/ui/admin/users/UserDetailView'

import type { Route } from './+types/wp-admin.users.detail'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户详情' }, bundleFromMatches(matches))
}

export default function WpAdminUserDetailRoute() {
  const { id } = useParams()
  return <UserDetailView userId={id ?? ''} />
}
