import { useOutletContext } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { CommentsView } from '@/ui/admin/comments/CommentsView'

import type { Route } from './+types/wp-admin.comments'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '评论管理' }, bundleFromMatches(matches))
}

export default function WpAdminCommentsRoute() {
  const { csrfToken, currentUser } = useOutletContext<{
    csrfToken: string
    currentUser: { id: string; name: string; email: string }
  }>()
  return (
    <CommentsView
      commentCsrfToken={csrfToken}
      currentUserName={currentUser.name}
      currentUserEmail={currentUser.email}
    />
  )
}
