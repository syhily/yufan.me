import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { TagsView } from '@/ui/admin/tags/TagsView'

import type { Route } from './+types/wp-admin.tags'

export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '标签管理' }, bundleFromMatches(matches))
}

export default function WpAdminTagsRoute() {
  return <TagsView />
}
