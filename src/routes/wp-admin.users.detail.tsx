import { routeMeta } from '@/server/seo/meta'
import { UserDetailView } from '@/ui/admin/users/UserDetailView'

import type { Route } from './+types/wp-admin.users.detail'

export function meta() {
  return routeMeta({ title: '用户详情' })
}

export async function loader({ params }: Route.LoaderArgs) {
  return { userId: params.id }
}

export default function WpAdminUserDetailRoute({ loaderData }: Route.ComponentProps) {
  return <UserDetailView userId={loaderData.userId} />
}
