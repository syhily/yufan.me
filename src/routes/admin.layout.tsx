import { isRouteErrorResponse, Link, Outlet, useRouteError } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicCss } from '@/client/hooks/use-detach-public-css'
import { useSiteIdentityOptional } from '@/ui/lib/blog-config-context'
// The login / install screen is admin chrome — same shadcn / Tailwind v4
// cascade the wp-admin SPA uses, so import `tailwind.css` directly. This
// keeps the public-site Bootstrap cascade (`public.css`) and the
// historical `admin.css` Bootstrap split-screen rules out of this route's
// chunk, matching the project's "admin pages do not load public.css"
// contract.
import '@/assets/styles/admin.css'

// Tells `root.tsx` to skip rendering `<BaseLayout>` for any descendant route
// so the admin / login stack can own its own chrome.
export const handle: RouteHandle = { layout: 'admin' }

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

export default function AdminLayoutRoute() {
  // Defensive cleanup mirroring the wp-admin SPA: when the user reaches
  // this route via a client-side navigation from the public site, RR
  // keeps the public `public.css` <link> attached to <head>. The
  // un-layered Bootstrap reset would otherwise smother every shadcn
  // primitive on this page (see hook docs for the full cascade story).
  useDetachPublicCss()

  // The login / install split-screen sits IN FRONT of the install gate
  // (the install page is the only way through the gate when the
  // deployment hasn't been initialised yet), so the blog-config context
  // can be `undefined` here — fall back to a hardcoded brand string so
  // the chrome stays meaningful on a fresh deployment.
  const siteIdentity = useSiteIdentityOptional()
  const siteTitle = siteIdentity?.title ?? '且听书吟'

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Soft brand-tinted backdrop. Pure CSS — no remote asset host
          dependency, so the screen renders identically on a fresh
          deployment that hasn't been installed yet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--accent),transparent_55%),radial-gradient(circle_at_bottom_right,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%)]"
      />
      <header className="flex items-center justify-between px-6 py-5 lg:px-10 lg:py-7">
        <Link to="/" title={siteTitle} prefetch="intent" className="flex items-center gap-3 text-foreground">
          {/* Inline `style` mirrors the wp-admin shell logo: the
              un-layered `img { height: auto }` reset from the public
              site beats Tailwind utilities on the first paint after an
              SPA navigation, so we lock the size with an inline style
              that wins against both un-layered selectors and Tailwind
              utilities. */}
          <img src="/logo-large.svg" alt={siteTitle} className="h-8 w-auto" style={{ height: '2rem', width: 'auto' }} />
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">{siteTitle} · 管理入口</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
