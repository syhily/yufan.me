import { data, Outlet, redirect, useLocation } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicCss } from '@/client/hooks/use-detach-public-css'
import { getRouteRequestContext, hasAtLeast, reuseOrIssueCsrfToken } from '@/server/session'
import { AdminErrorFallback } from '@/ui/admin/shell/AdminErrorFallback'
import { AdminShell } from '@/ui/admin/shell/AdminShell'

import type { Route } from './+types/wp-admin.layout'
// The wp-admin SPA only needs Tailwind v4 (with the `` prefix) plus the
// shadcn admin theme tokens declared inside `admin.css`. Importing
// `tailwind.css` directly here keeps Bootstrap reboot/grid/utilities and the
// public-site cascade (`public.css`) out of this route's chunk, matching
// the project's "admin pages do not load public.css" contract.
import '@/assets/styles/admin.css'

export const handle: RouteHandle = { layout: 'admin' }

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, user, url } = getRouteRequestContext({ request, context })
  if (!hasAtLeast(role, 'author')) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
  }

  // Reuse the existing CSRF cookie within its TTL window; only mint a fresh
  // token (and Set-Cookie) when the cookie is missing or expired.
  const issued = await reuseOrIssueCsrfToken(request)
  return data(
    {
      currentUser: {
        id: user?.id ?? '',
        name: user?.name ?? '管理员',
        email: user?.email ?? '',
        role: (user?.role ?? null) as 'admin' | 'author' | 'visitor' | null,
      },
      csrfToken: issued.token,
    },
    issued.setCookie === '' ? undefined : { headers: { 'Set-Cookie': issued.setCookie } },
  )
}

export { AdminErrorFallback as ErrorBoundary }

export default function WpAdminLayoutRoute({ loaderData }: Route.ComponentProps) {
  useDetachPublicCss()
  const { pathname } = useLocation()
  return (
    <AdminShell currentUser={loaderData.currentUser} pathname={pathname}>
      <Outlet context={{ csrfToken: loaderData.csrfToken, currentUser: loaderData.currentUser }} />
    </AdminShell>
  )
}
