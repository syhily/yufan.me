import { useNavigate, useParams } from 'react-router'

import { requireAdmin } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { UserDetailView } from '@/ui/admin/users/UserDetailView'

import type { Route } from './+types/wp-admin.users.detail'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户详情' }, bundleFromMatches(matches))
}

export default function WpAdminUserDetailRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <UserDetailView userId={id ?? ''} navigate={navigate} />
}
