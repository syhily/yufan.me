import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PageEditorShell } from '@/ui/admin/pages/PageEditorShell'

import type { Route } from './+types/wp-admin.pages.new'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '新建页面' }, bundleFromMatches(matches))
}

export default function WpAdminPageNewRoute() {
  return <PageEditorShell mode="create" />
}
