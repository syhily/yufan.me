import { useNavigate } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { PostEditorShell } from '@/ui/admin/posts/PostEditorShell'

import type { Route } from './+types/wp-admin.posts.new'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '新建文章' }, bundleFromMatches(matches))
}

export default function WpAdminPostNewRoute() {
  const navigate = useNavigate()
  return <PostEditorShell mode="create" navigate={navigate} />
}
