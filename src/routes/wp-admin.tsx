import { data, redirect } from 'react-router'

import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext, issueCsrfToken } from '@/server/session'
import { AdminCommentsPage } from '@/ui/admin/AdminCommentsPage'

import type { Route } from './+types/wp-admin'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { admin, user, url } = getRouteRequestContext({ request, context })
  if (!admin) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
  }

  const issued = await issueCsrfToken()
  return data({ currentUser: user, commentCsrfToken: issued.token }, { headers: { 'Set-Cookie': issued.setCookie } })
}

export function meta() {
  return routeMeta({ title: '评论管理' })
}

export default function AdminRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminCommentsPage
      commentCsrfToken={loaderData.commentCsrfToken}
      currentUserName={loaderData.currentUser?.name || ''}
      currentUserEmail={loaderData.currentUser?.email || ''}
    />
  )
}
