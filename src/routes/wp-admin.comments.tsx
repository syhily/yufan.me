import { useOutletContext } from 'react-router'

import { routeMeta } from '@/server/seo/meta'
import { CommentsView } from '@/ui/admin/comments/CommentsView'

export function meta() {
  return routeMeta({ title: '评论管理' })
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
