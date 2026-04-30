import type { MiddlewareFunction, ShouldRevalidateFunctionArgs } from 'react-router'

import { lazy, Suspense } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import { useFocusHash } from '@/client/hooks/use-focus-hash'
import { installGateMiddleware } from '@/server/install/gate'
import { wpDecoyMiddleware } from '@/server/middleware-wp-decoy'
import { NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext, sessionMiddleware } from '@/server/session'
import { _setBlogSettingsSnapshot, getBlogSettingsBundleSync } from '@/shared/blog-config-snapshot'
import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { NotWordPressView } from '@/ui/post/NotWordPressView'

import type { Route } from './+types/root'

// `PublicChrome` (which carries `globals.css`) is reached *statically* by
// every public URL through `routes/public.layout.tsx`, which is what makes
// the SSR `<Links />` output include the resolved stylesheet on first paint.
// The root `ErrorBoundary` only fires for errors that propagate above the
// route layouts (root middleware, root loader, or wp-decoy probes), so it
// can afford to lazy-load the chrome — that keeps the wp-admin SPA chunk
// free of `globals.css` while still giving fatal-error pages real styling.
//
// IMPORTANT: do NOT re-export `PublicChrome` (or any binding from
// `@/ui/primitives/PublicChrome` or `@/ui/primitives/BaseLayout`) from
// this module. A re-export pins the live binding statically and would
// drag `globals.css` into every route chunk, breaking the cascade
// contract documented in `tailwind.css` (#admin-buttons-no-padding).
const PublicChromeLazy = lazy(() => import('@/ui/primitives/PublicChrome').then((m) => ({ default: m.PublicChrome })))

// Order matters:
//   1. WordPress probe filter runs first so scanner traffic never
//      even touches Redis.
//   2. Session middleware decrypts the cookie + populates request
//      context.
//   3. Install gate redirects to `/wp-admin/install.php` when the
//      deployment hasn't been installed yet (no admin user OR no
//      `setting` row). Sits AFTER session so the gate's exemption list
//      can be reasoned about against the same context every loader sees.
export const middleware: MiddlewareFunction<Response>[] = [wpDecoyMiddleware, sessionMiddleware, installGateMiddleware]

export function meta() {
  return routeMeta()
}

export function links() {
  return [
    { rel: 'stylesheet', href: '/fonts/opposans.css' },
    { rel: 'stylesheet', href: '/fonts/opposerif.css' },
  ]
}

export function loader({ request, context }: Route.LoaderArgs) {
  const { admin } = getRouteRequestContext({ request, context })

  // The DB-backed blog config is serialised once per top-level request so
  // every UI component can read the live snapshot through the
  // per-section accessors. All fields (including the historically-static
  // asset / locale ones) now come from the in-process settings
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

  // Push the loader's snapshot into the shared `globalThis` slot on
  // EVERY render — both SSR (so server-only helpers like
  // `requireBlogConfig()` observe the same bundle the provider hands
  // out) and CSR (so client-side `meta()` callbacks after a SPA
  // navigation can read through `getBlogSettingsBundleSync()` instead
  // of the React context). The slot is overwritten, never appended,
  // so this stays cheap.
  _setBlogSettingsSnapshot(loaderData.blogSettings)

  // The chrome is owned by the matched layout route (`public.layout.tsx`,
  // `admin.layout.tsx`, or `wp-admin.layout.tsx`). The root just renders
  // the route tree wrapped in the per-section settings contexts that UI
  // components reach for through `useSiteIdentity()` /
  // `useFooterSettings()` / etc.
  return (
    <BlogSettingsProvider value={loaderData.blogSettings ?? undefined}>
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
  //   2. The in-process snapshot from the most recent successful render
  //      (`getBlogSettingsBundleSync()`).
  // Hydrate the slot too so any `getBlogSettingsBundleSync()` reachable
  // through the error tree (e.g. lazy chrome reading meta) sees the
  // same value.
  const blogSettings = loaderData?.blogSettings ?? getBlogSettingsBundleSync()
  _setBlogSettingsSnapshot(blogSettings)

  // WordPress probe decoy: `notWordPressSite()` throws a 404 Response whose
  // `statusText` we use as the marker. Render the dedicated view so scanners
  // see "this is not a WordPress site" instead of the generic "未找到页面".
  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return (
      <BlogSettingsProvider value={blogSettings ?? undefined}>
        <Suspense fallback={null}>
          {blogSettings ? (
            <PublicChromeLazy admin={loaderData?.admin ?? false}>
              <NotWordPressView />
            </PublicChromeLazy>
          ) : (
            <NotWordPressView />
          )}
        </Suspense>
      </BlogSettingsProvider>
    )
  }

  let title = '内部错误'
  let description = '抱歉，网站系统出现内部错误。请刷新页面重试，或者返回上一页。'

  if (isRouteErrorResponse(error) && error.status === 404) {
    title = '未找到页面'
    description = '抱歉，没有你要找的内容...'
  } else if (import.meta.env.DEV && error instanceof Error) {
    description = error.message
  }

  // Fallback for the (rare) case where we hit an error before any
  // request ever populated the snapshot — e.g. the root loader threw on
  // a deployment that hasn't been installed yet AND the install gate
  // somehow let the request through. Render a chrome-less message so
  // the user at least sees what went wrong instead of a blank page from
  // a strict per-section accessor throw inside the chrome.
  const body = (
    <div className="data-null">
      <div className="my-auto">
        <h1 className="font-number">{title === '未找到页面' ? '404' : '500'}</h1>
        <div>{description}</div>
      </div>
    </div>
  )

  return (
    <BlogSettingsProvider value={blogSettings ?? undefined}>
      <Suspense fallback={null}>
        {blogSettings ? <PublicChromeLazy admin={loaderData?.admin ?? false}>{body}</PublicChromeLazy> : body}
      </Suspense>
    </BlogSettingsProvider>
  )
}
