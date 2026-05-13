import { redirect, useNavigate } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { PageEditorShell } from '@/ui/admin/pages/PageEditorShell'

import type { Route } from './+types/wp-admin.pages.new'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') {
    throw redirect('/wp-admin/welcome')
  }
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '新建页面' }, bundleFromMatches(matches))
}

export default function WpAdminPageNewRoute() {
  const navigate = useNavigate()
  return <PageEditorShell mode="create" navigate={navigate} />
}
