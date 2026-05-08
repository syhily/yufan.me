import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PagesView } from '@/ui/admin/pages/PagesView'

import type { Route } from './+types/wp-admin.pages'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '页面管理' }, bundleFromMatches(matches))
}

export default function WpAdminPagesRoute() {
  return <PagesView />
}
