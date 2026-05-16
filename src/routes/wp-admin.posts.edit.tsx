import { useNavigate, useParams } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
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
