import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { MusicsView } from '@/ui/admin/musics/MusicsView'

import type { Route } from './+types/music'

export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '音乐管理' }, bundleFromMatches(matches))
}

export default function WpAdminMusicsRoute() {
  return <MusicsView />
}
