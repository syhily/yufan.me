import { requireRole } from '@/server/auth/rbac'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { PostsView } from '@/ui/admin/posts/PostsView'

import type { Route } from './+types/wp-admin.posts'

export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '文章管理' }, bundleFromMatches(matches))
}

export default function WpAdminPostsRoute() {
  return <PostsView />
}
