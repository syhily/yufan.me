import { redirect } from 'react-router'

import type { Route } from './+types/redirect.comments'

export function loader({ request }: Route.LoaderArgs) {
  // Preserve the query string so external bookmarks like
  // /my/comments?status=pending continue to land on the right tab.
  const url = new URL(request.url)
  return redirect(`/wp-admin/my/comments${url.search}`, { status: 301 })
}
