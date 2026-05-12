import { useNavigate, useParams } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PostEditorRoute } from '@/ui/admin/posts/PostEditorRoute'

import type { Route } from './+types/wp-admin.posts.edit'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '编辑文章' }, bundleFromMatches(matches))
}

export default function WpAdminPostEditRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <PostEditorRoute postId={id ?? ''} navigate={navigate} />
}
