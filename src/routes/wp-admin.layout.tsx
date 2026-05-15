import { data, Outlet, redirect, useLocation } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicCss } from '@/client/hooks/use-detach-public-css'
import { getRouteRequestContext } from '@/server/auth/context'
import { reuseOrIssueCsrfToken } from '@/server/auth/csrf'
import { hasAtLeast } from '@/server/auth/rbac'
import { AdminErrorFallback } from '@/ui/admin/shell/AdminErrorFallback'
import { AdminShell } from '@/ui/admin/shell/AdminShell'
import { PostFontLinks } from '@/ui/public/post/PostFontLinks'

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
  // Self-service visitors land on `/wp-admin/my/profile`; other admin
  // routes have their own per-route `requireRole` gate that promotes
  // the minimum to `author` (content management) or `admin` (settings,
  // user management, friends). Keeping the layout open to visitors
  // lets a logged-in commenter reach their own profile without us
  // having to ship two parallel chromes.
  if (!hasAtLeast(role, 'visitor')) {
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
    <>
      {/*
        globalCss already loads on every route via root.tsx's <Layout>;
        admin additionally pulls in postCss so the page-body editor
        preview and any in-admin `.prose-blog` rendering see the same
        serif typography the public article surface gets.
      */}
      <PostFontLinks />
      {/*
        CSRF anchor for the ts-rest API client. The csrf cookie is
        HttpOnly so JS can't read it; the client picks up the matching
        token from this meta tag and sends it as `X-CSRF-Token` on
        every mutation. React updates the `content` attribute when
        the loader revalidates (token rotation, fresh login), so
        long-lived admin sessions stay valid automatically. See
        `src/client/api/client.ts`.
      */}
      <meta name="csrf-token" content={loaderData.csrfToken} />
      <AdminShell currentUser={loaderData.currentUser} pathname={pathname}>
        <Outlet context={{ csrfToken: loaderData.csrfToken, currentUser: loaderData.currentUser }} />
      </AdminShell>
    </>
  )
}
