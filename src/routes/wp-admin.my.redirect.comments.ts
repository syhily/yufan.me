import { redirect } from 'react-router'

import type { Route } from './+types/wp-admin.my.redirect.comments'

export function loader({ request }: Route.LoaderArgs) {
  // Preserve the query string so /wp-admin/my/comments?offset=10 still works.
  const url = new URL(request.url)
  return redirect(`/my/comments${url.search}`, { status: 301 })
}
