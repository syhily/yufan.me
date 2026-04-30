import { routeMeta } from '@/server/seo/meta'
import { UsersView } from '@/ui/admin/users/UsersView'

export function meta() {
  return routeMeta({ title: '用户管理' })
}

export default function WpAdminUsersRoute() {
  return <UsersView />
}
