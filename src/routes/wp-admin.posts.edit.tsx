import { useNavigate, useParams } from 'react-router'

import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { PostEditorRoute } from '@/ui/admin/posts/PostEditorRoute'

import type { Route } from './+types/wp-admin.posts.edit'

export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑文章' }, bundleFromMatches(matches))
}

export default function WpAdminPostEditRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <PostEditorRoute postId={id ?? ''} navigate={navigate} />
}
