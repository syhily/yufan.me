import { redirect } from 'react-router'

import type { Route } from './+types/wp-admin.my.redirect.profile'

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  return redirect(`/my/profile${url.search}`, { status: 301 })
}
