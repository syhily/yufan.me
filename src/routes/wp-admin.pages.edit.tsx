import { useNavigate, useParams } from 'react-router'

import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PageEditorRoute } from '@/ui/admin/pages/PageEditorRoute'

import type { Route } from './+types/wp-admin.pages.edit'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑页面' }, bundleFromMatches(matches))
}

export default function WpAdminPageEditRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <PageEditorRoute pageId={id ?? ''} navigate={navigate} />
}
