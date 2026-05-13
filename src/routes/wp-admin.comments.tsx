import { redirect } from 'react-router'
import { useOutletContext, useSearchParams } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { CommentsView } from '@/ui/admin/comments/CommentsView'

import type { Route } from './+types/wp-admin.comments'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = getRouteRequestContext({ request, context })
  if (role !== 'admin') throw redirect('/wp-admin/welcome')
  return null
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '评论管理' }, bundleFromMatches(matches))
}

export default function WpAdminCommentsRoute() {
  const { csrfToken, currentUser } = useOutletContext<{
    csrfToken: string
    currentUser: { id: string; name: string; email: string }
  }>()
  const [searchParams] = useSearchParams()
  return (
    <CommentsView
      commentCsrfToken={csrfToken}
      currentUserName={currentUser.name}
      currentUserEmail={currentUser.email}
      initialAuthorId={searchParams.get('userId') ?? undefined}
      initialPageKey={searchParams.get('pageKey') ?? undefined}
      initialStatus={(searchParams.get('status') as 'all' | 'pending' | 'approved') ?? undefined}
    />
  )
}
