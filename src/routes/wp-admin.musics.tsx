import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { MusicsView } from '@/ui/admin/musics/MusicsView'

import type { Route } from './+types/wp-admin.musics'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '音乐管理' }, bundleFromMatches(matches))
}

export default function WpAdminMusicsRoute() {
  return <MusicsView />
}
