import type { MiddlewareFunction, ShouldRevalidateFunctionArgs } from 'react-router'

import { lazy, Suspense } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches } from 'react-router'

import { useFocusHash } from '@/client/hooks/use-focus-hash'
import { wpDecoyMiddleware } from '@/server/middleware-wp-decoy'
import { NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext, sessionMiddleware } from '@/server/session'
import { NotWordPressView } from '@/ui/post/NotWordPressView'

import type { Route } from './+types/root'

// `BaseLayout` and `globals.css` (Bootstrap + public site cascade) live in
// their own chunk so admin/login routes that opt out via `handle.layout =
// 'admin'` never pull the public stylesheet bundle. The lazy boundary also
// means the wp-admin SPA chunk stays Bootstrap-free.
//
// IMPORTANT: do NOT re-export `BaseLayout` (or any other binding from
// `@/ui/primitives/BaseLayout`) eagerly from this module. Even an unused
// `export { BaseLayout } from '…'` line statically pins the module —
// because the re-export must observe the live binding — which in turn
// pulls `globals.css` into every page chunk including `/wp-admin/*`.
// That breaks the cascade contract documented in `tailwind.css`: the
// un-layered `button { padding: 0; border: none }` rule from
// `reset.css` then beats the layered `tw:px-5` / `tw:border` utilities,
// stripping all padding from shadcn buttons (#admin-buttons-no-padding).
// Tests that need the chrome synchronously should import `BaseLayout`
// directly from `@/ui/primitives/BaseLayout`.
const BaseLayoutLazy = lazy(() => import('@/ui/primitives/BaseLayout').then((m) => ({ default: m.BaseLayout })))

export type { BaseLayoutProps } from '@/ui/primitives/BaseLayout'

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

  return { admin }
}

// The root loader only ships `{ admin }`, which can flip on three POST
// endpoints: the WordPress-compatible login (`/wp-login.php`), the bootstrap
// installer (`/wp-admin/install`), and the logout endpoint (`/wp-login.php?action=logout`).
// Every other navigation/fetcher submission leaves the session untouched, so
// short-circuit revalidation here to skip a `RouterContext` read per nav.
export function shouldRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formAction && (formAction.startsWith('/wp-login.php') || formAction.startsWith('/wp-admin/install'))) {
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
// `"admin"` short-circuits the default `<BaseLayout>` so the admin/login
// stack can render its own chrome instead. Routes can also disable the
// site footer with `handle.footer = false` (see `routes/page.detail.tsx`).
export type RouteHandle = {
  layout?: 'admin'
  footer?: boolean
}

export default function App({ loaderData }: Route.ComponentProps) {
  useFocusHash()

  const { layout, footer } = useMatches().reduce<{
    layout: RouteHandle['layout']
    footer: boolean
  }>(
    (acc, match) => {
      const handle = match.handle as RouteHandle | undefined
      if (handle?.layout) acc.layout = handle.layout
      if (handle?.footer === false) acc.footer = false
      return acc
    },
    { layout: undefined, footer: true },
  )

  if (layout === 'admin') {
    return <Outlet />
  }

  return (
    <Suspense fallback={null}>
      <BaseLayoutLazy admin={loaderData?.admin ?? false} footer={footer}>
        <Outlet />
      </BaseLayoutLazy>
    </Suspense>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  // WordPress probe decoy: `notWordPressSite()` throws a 404 Response whose
  // `statusText` we use as the marker. Render the dedicated view so scanners
  // see "this is not a WordPress site" instead of the generic "未找到页面".
  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return (
      <Suspense fallback={null}>
        <BaseLayoutLazy admin={loaderData?.admin ?? false}>
          <NotWordPressView />
        </BaseLayoutLazy>
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
      <BaseLayoutLazy admin={loaderData?.admin ?? false}>
        <div className="data-null">
          <div className="my-auto">
            <h1 className="font-number">{title === '未找到页面' ? '404' : '500'}</h1>
            <div>{description}</div>
          </div>
        </div>
      </BaseLayoutLazy>
    </Suspense>
  )
}
