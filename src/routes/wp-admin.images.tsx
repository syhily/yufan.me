import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { ImagesView } from '@/ui/admin/images/ImagesView'

import type { Route } from './+types/wp-admin.images'

export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '图片管理' }, bundleFromMatches(matches))
}

export default function WpAdminImagesRoute() {
  return <ImagesView />
}
