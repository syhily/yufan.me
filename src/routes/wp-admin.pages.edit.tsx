import { redirect } from 'react-router'
import { useNavigate, useParams } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { PageEditorRoute } from '@/ui/admin/pages/PageEditorRoute'

import type { Route } from './+types/wp-admin.pages.edit'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') throw redirect('/wp-admin/welcome')
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
