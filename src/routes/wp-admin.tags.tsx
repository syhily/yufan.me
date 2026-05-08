import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { TagsView } from '@/ui/admin/tags/TagsView'

import type { Route } from './+types/wp-admin.tags'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '标签管理' }, bundleFromMatches(matches))
}

export default function WpAdminTagsRoute() {
  return <TagsView />
}
