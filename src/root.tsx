import type { MiddlewareFunction, ShouldRevalidateFunctionArgs } from 'react-router'

import { lazy, Suspense } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import { useFocusHash } from '@/client/hooks/use-focus-hash'
import { installGateMiddleware } from '@/server/middleware/install-gate'
import { sessionMiddleware } from '@/server/middleware/session'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { getBlogSettingsBundleSync } from '@/shared/blog-config'
import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { ErrorView } from '@/ui/post/ErrorView'
import { NavigationSplash } from '@/ui/primitives/NavigationSplash'

import type { Route } from './+types/root'

// `PublicChrome` (which carries `public.css`) is reached *statically* by
// every public URL through `routes/public.layout.tsx`, which is what makes
// the SSR `<Links />` output include the resolved stylesheet on first paint.
// The root `ErrorBoundary` only fires for errors that propagate above the
// route layouts (root middleware, root loader, or wp-decoy probes), so it
// can afford to lazy-load the chrome — that keeps the wp-admin SPA chunk
// free of `public.css` while still giving fatal-error pages real styling.
//
// IMPORTANT: do NOT re-export `PublicChrome` (or any binding from
// `@/ui/primitives/PublicChrome` or `@/ui/primitives/BaseLayout`) from
// this module. A re-export pins the live binding statically and would
// drag `public.css` into every route chunk, breaking the cascade
// contract documented in `tailwind.css` (#admin-buttons-no-padding).
const PublicChromeLazy = lazy(() => import('@/ui/primitives/PublicChrome').then((m) => ({ default: m.PublicChrome })))

// Order matters:
//   1. Session middleware decrypts the cookie + populates request
//      context.
//   2. Install gate redirects to `/wp-admin/install.php` when the
//      deployment hasn't been installed yet (no admin user OR no
//      `setting` row). Sits AFTER session so the gate's exemption list
//      can be reasoned about against the same context every loader sees.
//
// WordPress probe interception is NOT a root middleware. React Router
// routes a middleware throw thrown BEFORE `next()` to the ErrorBoundary
// of the *highest route with a loader* and refuses to render any
// component below it (no `loaderData` available; see RR docs §"next()
// and Error Handling"). Putting the probe filter on root would
// therefore force scanner 404s through root's lazy-chrome
// `ErrorBoundary` and lose the synchronous `<PublicChrome>` shell that
// the public layout's boundary already provides for real 404s.
// Instead, the two routes that can legitimately receive a probe path
// (`page.detail` for single-segment `.php`/`cgi-bin`, `not-found` for
// the splat) call `assertNotWordPressDecoy()` at the top of their
// loader, so the throw originates inside a leaf loader and bubbles up
// to the public layout's `ErrorBoundary` exactly like a normal 404.
export const middleware: MiddlewareFunction<Response>[] = [sessionMiddleware, installGateMiddleware]

export function meta({ loaderData, matches }: Route.MetaArgs) {
  // `meta()` runs on both SSR and after every client-side navigation,
  // so we read the bundle from the explicit data path (root loader
  // payload) rather than a `globalThis` slot. The fallback chain is
  // (1) the loader's own `blogSettings`, (2) the bundle hanging off
  // the root match (matches the helper used by leaf routes), then
  // (3) the SSR-only boot-hydrated snapshot for non-React server
  // modules — none of which apply on the client, so passing
  // `undefined` lets `routeMeta()` degrade to its pre-install
  // fallback if no source has the bundle yet.
  return routeMeta(undefined, loaderData?.blogSettings ?? bundleFromMatches(matches))
}

export function links() {
  return [
    { rel: 'stylesheet', href: '/fonts/opposans.css' },
    { rel: 'stylesheet', href: '/fonts/opposerif.css' },
    { rel: 'stylesheet', href: '/fonts/iosevka.css' },
  ]
}

export function loader({ request, context }: Route.LoaderArgs) {
  const { admin } = getRouteRequestContext({ request, context })

  // The DB-backed blog config is serialised once per top-level request so
  // every UI component can read the live snapshot through the
  // per-section accessors. All fields (including asset / locale slices) come
  // from the in-process settings
  // snapshot, which is hydrated on server start and refreshed on every
  // admin save. The wire shape is `BlogSettingsBundle` (one bucket per
  // section) so the client provider can hand each section to its own
  // React context instead of forcing every consumer to re-render when
  // an unrelated section changes.
  //
  // `null` is possible on a fresh, uninstalled deployment — the install
  // gate above intercepts every non-install request, so this loader only
  // returns `null` when serving the install split-screen itself.
  const blogSettings = getBlogSettingsBundleSync()

  return { admin, blogSettings }
}

// The root loader ships `{ admin, blogSettings }`. Both can change at
// runtime: `admin` flips on three POST endpoints (login, install,
// logout); `blogSettings` flips whenever an admin saves a settings page.
// Revalidate when any of those actions submit, plus when an admin
// settings save fires from `/api/actions/admin/updateSettings` (the
// settings layout already calls `useRevalidator()`, but admin saves
// going through other tabs need this safety net too).
export function shouldRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (
    formAction &&
    (formAction.startsWith('/wp-login.php') ||
      formAction.startsWith('/wp-admin/install') ||
      formAction.startsWith('/api/actions/admin/updateSettings'))
  ) {
    return defaultShouldRevalidate
  }
  return false
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// Routes can opt-in to a custom chrome by exporting a `handle.layout` value.
// `"admin"` marks routes that own their own chrome (admin SPA, login/install
// split-screen). Routes can also disable the site footer with
// `handle.footer = false` (see `routes/page.detail.tsx`).
export type RouteHandle = {
  layout?: 'admin'
  footer?: boolean
}

export default function App({ loaderData }: Route.ComponentProps) {
  useFocusHash()

  // The bundle flows down through `BlogSettingsProvider` (per-section
  // contexts) and the route data path (`Route.MetaArgs.matches`). On
  // the server, non-React modules read the boot-hydrated snapshot in
  // `@/server/settings/snapshot`; on the client they don't run at
  // all. There is no longer a render-time `globalThis` write here.
  //
  // The chrome is owned by the matched layout route (`public.layout.tsx`,
  // `admin.layout.tsx`, or `wp-admin.layout.tsx`). The root just renders
  // the route tree wrapped in the per-section settings contexts that UI
  // components reach for through `useSiteIdentity()` /
  // `useFooterSettings()` / etc.
  return (
    <BlogSettingsProvider value={loaderData.blogSettings ?? undefined}>
      <NavigationSplash />
      <Outlet />
    </BlogSettingsProvider>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  // The root `ErrorBoundary` mounts INSTEAD of `App`, so the surrounding
  // `<BlogSettingsProvider>` from `App` is not in scope. The chrome
  // below depends on the per-section accessors
  // (Header/Footer/Image/…), so we re-establish the provider here
  // using whichever bundle is reachable:
  //   1. The root loader's `loaderData.blogSettings` (when the loader ran).
  //   2. The SSR-only boot-hydrated snapshot
  //      (`getBlogSettingsBundleSync()`); this is `null` on the client
  //      because we no longer mirror the provider into `globalThis` —
  //      which is fine because the same payload is reachable through
  //      `loaderData` whenever the root loader actually ran.
  const blogSettings = loaderData?.blogSettings ?? getBlogSettingsBundleSync()

  // Body decision is shared with `routes/public.layout.tsx`'s
  // boundary via `<ErrorView />`. Keeping the body off-component
  // guarantees scanner traffic and real 404s get the same shell.
  const body = <ErrorView error={error} isDev={import.meta.env.DEV} />

  // Fallback for the (rare) case where we hit an error before any
  // request ever populated the snapshot — e.g. the root loader threw on
  // a deployment that hasn't been installed yet AND the install gate
  // somehow let the request through. Render a chrome-less message so
  // the user at least sees what went wrong instead of a blank page from
  // a strict per-section accessor throw inside the chrome.
  return (
    <BlogSettingsProvider value={blogSettings ?? undefined}>
      <Suspense fallback={null}>
        {blogSettings ? (
          <PublicChromeLazy admin={loaderData?.admin ?? false} pathname="/" search="">
            {body}
          </PublicChromeLazy>
        ) : (
          body
        )}
      </Suspense>
    </BlogSettingsProvider>
  )
}
