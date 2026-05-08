import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PageEditorRoute } from '@/ui/admin/pages/PageEditorRoute'

import type { Route } from './+types/wp-admin.pages.edit'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑页面' }, bundleFromMatches(matches))
}

export async function loader({ params }: Route.LoaderArgs) {
  return { pageId: params.id }
}

export default function WpAdminPageEditRoute({ loaderData }: Route.ComponentProps) {
  return <PageEditorRoute pageId={loaderData.pageId} />
}
