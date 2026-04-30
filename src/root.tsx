import type { MiddlewareFunction, ShouldRevalidateFunctionArgs } from 'react-router'

import { lazy, Suspense } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import { useFocusHash } from '@/client/hooks/use-focus-hash'
import { wpDecoyMiddleware } from '@/server/middleware-wp-decoy'
import { NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext, sessionMiddleware } from '@/server/session'
import { getBlogConfigSync } from '@/shared/blog-config-snapshot'
import { BlogConfigProvider } from '@/ui/lib/blog-config-context'
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

// Order matters: the WordPress probe filter runs before session decryption
// so scanner traffic never even touches Redis.
export const middleware: MiddlewareFunction<Response>[] = [wpDecoyMiddleware, sessionMiddleware]

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
  // every UI component can read the live snapshot through `useBlogConfig()`.
  // Bucket-A constants (asset host, OG dims, locale/timeZone/timeFormat)
  // come from `@/blog.config`; bucket-B fields come from the in-process
  // settings snapshot, refreshed on every admin save.
  const blogConfig = getBlogConfigSync()

  return { admin, blogConfig }
}

// The root loader ships `{ admin, blogConfig }`. Both can change at
// runtime: `admin` flips on three POST endpoints (login, install,
// logout); `blogConfig` flips whenever an admin saves a settings page.
// Revalidate when any of those actions submit, plus when an admin
// settings save fires from `/api/actions/admin/...Settings` (the
// settings layout already calls `useRevalidator()`, but admin saves
// going through other tabs need this safety net too).
export function shouldRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (
    formAction &&
    (formAction.startsWith('/wp-login.php') ||
      formAction.startsWith('/wp-admin/install') ||
      formAction.startsWith('/api/actions/admin/updateSettings') ||
      formAction.startsWith('/api/actions/admin/resetSettings'))
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

  // The chrome is owned by the matched layout route (`public.layout.tsx`,
  // `admin.layout.tsx`, or `wp-admin.layout.tsx`). The root just renders
  // the route tree wrapped in the blog-config context that every public
  // component reads through `useBlogConfig()`.
  return (
    <BlogConfigProvider value={loaderData.blogConfig}>
      <Outlet />
    </BlogConfigProvider>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  // WordPress probe decoy: `notWordPressSite()` throws a 404 Response whose
  // `statusText` we use as the marker. Render the dedicated view so scanners
  // see "this is not a WordPress site" instead of the generic "未找到页面".
  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return (
      <Suspense fallback={null}>
        <PublicChromeLazy admin={loaderData?.admin ?? false}>
          <NotWordPressView />
        </PublicChromeLazy>
      </Suspense>
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

  return (
    <Suspense fallback={null}>
      <PublicChromeLazy admin={loaderData?.admin ?? false}>
        <div className="data-null">
          <div className="my-auto">
            <h1 className="font-number">{title === '未找到页面' ? '404' : '500'}</h1>
            <div>{description}</div>
          </div>
        </div>
      </PublicChromeLazy>
    </Suspense>
  )
}
