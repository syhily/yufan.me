import { useOutletContext } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { MyCommentsView } from '@/ui/admin/my/MyCommentsView'

import type { Route } from './+types/wp-admin.my.comments'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '我的评论' }, bundleFromMatches(matches))
}

export default function WpAdminMyCommentsRoute() {
  const { csrfToken, currentUser } = useOutletContext<{
    csrfToken: string
    currentUser: { id: string; name: string; email: string }
  }>()
  return <MyCommentsView csrfToken={csrfToken} userId={currentUser.id} />
}
