import { useParams } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PageEditorRoute } from '@/ui/admin/pages/PageEditorRoute'

import type { Route } from './+types/wp-admin.pages.edit'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑页面' }, bundleFromMatches(matches))
}

export default function WpAdminPageEditRoute() {
  const { id } = useParams()
  return <PageEditorRoute pageId={id ?? ''} />
}
