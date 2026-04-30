import { data, Outlet, redirect } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicGlobalsCss } from '@/client/hooks/use-detach-public-globals-css'
import { getRouteRequestContext, issueCsrfToken } from '@/server/session'
import { AdminShell } from '@/ui/admin/shell/AdminShell'

import type { Route } from './+types/wp-admin.layout'
// The wp-admin SPA only needs Tailwind v4 (with the `tw:` prefix) plus the
// shadcn admin theme tokens declared inside `admin-theme.css`. Importing
// `tailwind.css` directly here keeps Bootstrap reboot/grid/utilities and the
// public-site cascade (`globals.css`) out of this route's chunk, matching
// the project's "admin pages do not load globals.css" contract.
import '@/assets/styles/tailwind.css'

export const handle: RouteHandle = { layout: 'admin' }

export async function loader({ request, context }: Route.LoaderArgs) {
  const { admin, user, url } = getRouteRequestContext({ request, context })
  if (!admin) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
  }

  // Reissue a CSRF token at the layout level so every child page (and
  // every modal/form mounted under the SPA shell) shares the same
  // freshly-rotated token without each route having to ask for it again.
  const issued = await issueCsrfToken()
  return data(
    {
      currentUser: {
        id: user?.id ?? '',
        name: user?.name ?? '管理员',
        email: user?.email ?? '',
      },
      csrfToken: issued.token,
    },
    { headers: { 'Set-Cookie': issued.setCookie } },
  )
}

export default function WpAdminLayoutRoute({ loaderData }: Route.ComponentProps) {
  useDetachPublicGlobalsCss()
  return (
    <AdminShell currentUser={loaderData.currentUser}>
      <Outlet context={{ csrfToken: loaderData.csrfToken, currentUser: loaderData.currentUser }} />
    </AdminShell>
  )
}
