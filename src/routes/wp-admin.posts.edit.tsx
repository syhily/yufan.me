import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PostEditorRoute } from '@/ui/admin/posts/PostEditorRoute'

import type { Route } from './+types/wp-admin.posts.edit'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑文章' }, bundleFromMatches(matches))
}

export async function loader({ params }: Route.LoaderArgs) {
  return { postId: params.id }
}

export default function WpAdminPostEditRoute({ loaderData }: Route.ComponentProps) {
  return <PostEditorRoute postId={loaderData.postId} />
}
