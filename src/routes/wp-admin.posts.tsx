import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PostsView } from '@/ui/admin/posts/PostsView'

import type { Route } from './+types/wp-admin.posts'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '文章管理' }, bundleFromMatches(matches))
}

export default function WpAdminPostsRoute() {
  return <PostsView />
}
