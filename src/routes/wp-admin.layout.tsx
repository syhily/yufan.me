import { data, isRouteErrorResponse, Outlet, redirect, useLocation, useRouteError } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicCss } from '@/client/hooks/use-detach-public-css'
import { getRouteRequestContext, reuseOrIssueCsrfToken } from '@/server/session'
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
  const { admin, user, url } = getRouteRequestContext({ request, context })
  if (!admin) {
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
      },
      csrfToken: issued.token,
    },
    issued.setCookie === '' ? undefined : { headers: { 'Set-Cookie': issued.setCookie } },
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : '出错了'
  const message = isRouteErrorResponse(error)
    ? typeof error.data === 'string'
      ? error.data
      : error.statusText
    : error instanceof Error
      ? error.message
      : '未知错误'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-semibold text-red-500">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default function WpAdminLayoutRoute({ loaderData }: Route.ComponentProps) {
  useDetachPublicCss()
  const { pathname } = useLocation()
  return (
    <AdminShell currentUser={loaderData.currentUser} pathname={pathname}>
      <Outlet context={{ csrfToken: loaderData.csrfToken, currentUser: loaderData.currentUser }} />
    </AdminShell>
  )
}
