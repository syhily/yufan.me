import { useNavigate } from 'react-router'

import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PageEditorShell } from '@/ui/admin/pages/PageEditorShell'

import type { Route } from './+types/wp-admin.pages.new'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '新建页面' }, bundleFromMatches(matches))
}

export default function WpAdminPageNewRoute() {
  const navigate = useNavigate()
  return <PageEditorShell mode="create" navigate={navigate} />
}
