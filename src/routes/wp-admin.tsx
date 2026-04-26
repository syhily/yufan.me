import { redirect } from 'react-router'

import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { AdminCommentsPage } from '@/ui/admin/AdminCommentsPage'

import type { Route } from './+types/wp-admin'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { admin, user, url } = getRouteRequestContext({ request, context })
  if (!admin) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
  }

  return {
    currentUser: user,
  }
}

export function meta() {
  return routeMeta({ title: '评论管理' })
}

export default function AdminRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminCommentsPage
      currentUserName={loaderData.currentUser?.name || ''}
      currentUserEmail={loaderData.currentUser?.email || ''}
    />
  )
}
