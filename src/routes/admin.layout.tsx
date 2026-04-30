import { useEffect } from 'react'
import { Link, Outlet } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicGlobalsCss } from '@/client/hooks/use-detach-public-globals-css'
import { useSiteIdentityOptional } from '@/ui/lib/blog-config-context'
// The login / install screen is admin chrome — same shadcn / Tailwind v4
// cascade the wp-admin SPA uses, so import `tailwind.css` directly. This
// keeps the public-site Bootstrap cascade (`globals.css`) and the
// historical `admin.css` Bootstrap split-screen rules out of this route's
// chunk, matching the project's "admin pages do not load globals.css"
// contract.
import '@/assets/styles/tailwind.css'

// Tells `root.tsx` to skip rendering `<BaseLayout>` for any descendant route
// so the admin / login stack can own its own chrome.
export const handle: RouteHandle = { layout: 'admin' }

export default function AdminLayoutRoute() {
  // Defensive cleanup mirroring the wp-admin SPA: when the user reaches
  // this route via a client-side navigation from the public site, RR
  // keeps the public `globals.css` <link> attached to <head>. The
  // un-layered Bootstrap reset would otherwise smother every shadcn
  // primitive on this page (see hook docs for the full cascade story).
  useDetachPublicGlobalsCss()

  // Bridge the `[data-admin-shell]` theme variables to portaled popups.
  // Base UI's `Select` / `Combobox` / `Dialog` / `Tooltip` mount their
  // popups under `document.body`, which lives outside the
  // `[data-admin-shell]` subtree below. Without this attribute the
  // shadcn theme tokens (`--popover`, `--accent`, …) stay undefined on
  // the portal, the popover renders with a transparent background, and
  // dropdowns appear to "bleed" into the form rows below them (the
  // user-reported "安装页面的样式不对" symptom). The wp-admin SPA does
  // exactly the same in `AdminShell`; mirror it here so login / install
  // / Stage-2 install screens get the same portal palette.
  useEffect(() => {
    document.body.dataset.adminShell = ''
    return () => {
      delete document.body.dataset.adminShell
    }
  }, [])

  // The login / install split-screen sits IN FRONT of the install gate
  // (the install page is the only way through the gate when the
  // deployment hasn't been initialised yet), so the blog-config context
  // can be `undefined` here — fall back to a hardcoded brand string so
  // the chrome stays meaningful on a fresh deployment.
  const siteIdentity = useSiteIdentityOptional()
  const siteTitle = siteIdentity?.title ?? '且听书吟'

  return (
    <div
      data-admin-shell
      className="tw:bg-background tw:text-foreground tw:relative tw:flex tw:min-h-screen tw:flex-col"
    >
      {/* Soft brand-tinted backdrop. Pure CSS — no remote asset host
          dependency, so the screen renders identically on a fresh
          deployment that hasn't been installed yet. */}
      <div
        aria-hidden
        className="tw:pointer-events-none tw:absolute tw:inset-0 tw:-z-10 tw:bg-[radial-gradient(circle_at_top_left,var(--accent),transparent_55%),radial-gradient(circle_at_bottom_right,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%)]"
      />
      <header className="tw:flex tw:items-center tw:justify-between tw:px-6 tw:py-5 tw:lg:px-10 tw:lg:py-7">
        <Link
          to="/"
          title={siteTitle}
          prefetch="intent"
          className="tw:flex tw:items-center tw:gap-3 tw:text-foreground"
        >
          {/* Inline `style` mirrors the wp-admin shell logo: the
              un-layered `img { height: auto }` reset from the public
              site beats Tailwind utilities on the first paint after an
              SPA navigation, so we lock the size with an inline style
              that wins against both un-layered selectors and Tailwind
              utilities. */}
          <img
            src="/logo-large.svg"
            alt={siteTitle}
            className="tw:h-8 tw:w-auto"
            style={{ height: '2rem', width: 'auto' }}
          />
        </Link>
        <span className="tw:text-muted-foreground tw:hidden tw:text-sm tw:sm:inline">{siteTitle} · 管理入口</span>
      </header>
      <main className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:px-4 tw:py-8 tw:sm:py-12">
        <div className="tw:w-full tw:max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
