import type { ReactNode } from 'react'
import type { MiddlewareFunction, ShouldRevalidateFunctionArgs } from 'react-router'

import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useNavigation,
} from 'react-router'

import config, { type BlogConfig } from '@/blog.config'
import { useFocusHash } from '@/client/hooks/use-focus-hash'
import { wpDecoyMiddleware } from '@/server/middleware-wp-decoy'
import { NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'
import { routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext, sessionMiddleware } from '@/server/session'
import { cn } from '@/ui/lib/cn'
import { NotWordPressView } from '@/ui/post/NotWordPressView'
import { Footer } from '@/ui/primitives/Footer'
import { Header } from '@/ui/primitives/Header'
import { ScrollTopButton } from '@/ui/primitives/ScrollTopButton'
import { SiteConfigProvider } from '@/ui/primitives/site-config'
import { ToastProvider, ToastSurface } from '@/ui/primitives/Toast'

import type { Route } from './+types/root'
import '@/assets/styles/globals.css'

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

  // Compute the calendar year on the server so SSR and CSR agree.
  // Rendering `new Date().getFullYear()` inside `<Footer>` would mismatch
  // when the server renders Dec 31 23:59 UTC and the client hydrates as
  // Jan 1 00:00 local — invisible 364/365 days, brittle on the boundary.
  const currentYear = new Date().getFullYear()

  return { admin, currentYear }
}

// The root loader only ships `{ admin }`, which can flip on the
// WordPress-compatible login (`/wp-login.php`) and the logout action
// (`/wp-login.php?action=logout`), plus a future install route
// (`/wp-admin/install`, when remounted) if forms post there again.
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
        <NavigationProgress />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// Visual indicator that paints while React Router is fetching loader/action
// data. Driven by `useNavigation()` so it covers `<Link>` clicks, programmatic
// `navigate()` calls, and route-level `<Form>` submissions; per-domain
// `useFetcher` activity (comment moderation, like clicks, etc.) is owned by
// `useApiAction` / `useApiStream` and is intentionally excluded so this bar
// only reflects route-level transitions.
//
// Lives at the very top of the viewport above page chrome via `--z-sticky`.
// During SSR, `useNavigation().state` is `'idle'` so the bar starts collapsed
// (`scale-x-0`); the CSS transition handles the grow/shrink animation,
// avoiding a layout pass each frame and skipping a `useEffect` round-trip.
function NavigationProgress() {
  const navigation = useNavigation()
  const pending = navigation.state !== 'idle'
  return (
    <div
      aria-hidden
      data-pending={pending ? '' : undefined}
      className={cn(
        'pointer-events-none fixed top-0 right-0 left-0 h-0.5 z-(--z-sticky)',
        'origin-left bg-accent transition-transform duration-200 ease-out',
        pending ? 'scale-x-100' : 'scale-x-0',
      )}
    />
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

export interface BaseLayoutProps {
  navigation?: BlogConfig['navigation']
  footer?: boolean
  admin: boolean
  children?: ReactNode
}

// Body-chrome wrapper: header + main region + fixed widgets. The wrapping
// `<html>`, `<head>`, and `<body>` live in `Layout` above.
//
// Exported so `tests/snapshot.layout.test.tsx` can render the chrome in
// isolation; production callers should rely on the default `<App>` export
// rather than instantiating `BaseLayout` directly.
//
// `<Footer>` reads `currentYear` from the root loader via
// `useRouteLoaderData('root')`, so neither `BaseLayout` nor the page-level
// detail bodies have to thread the year through props.
export function BaseLayout({ navigation, footer, admin, children }: BaseLayoutProps) {
  const showFooter = footer !== undefined ? footer : true
  const resolvedNavigation = navigation || config.navigation

  return (
    <SiteConfigProvider value={config}>
      <ToastProvider>
        <div className="flex flex-col lg:flex-row">
          <Header navigation={resolvedNavigation} admin={admin} />
          <main className="flex flex-1 flex-col">
            {children}
            {showFooter && <Footer />}
          </main>
          <ScrollTopButton />
        </div>
        <ToastSurface />
      </ToastProvider>
    </SiteConfigProvider>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  useFocusHash()

  const { layout, footer } = useMatches().reduce<{
    layout: RouteHandle['layout']
    footer: boolean
  }>(
    (acc, match) => {
      const handle = match.handle as RouteHandle | undefined
      if (handle?.layout) {
        acc.layout = handle.layout
      }
      if (handle?.footer === false) {
        acc.footer = false
      }
      return acc
    },
    { layout: undefined, footer: true },
  )

  if (layout === 'admin') {
    return <Outlet />
  }

  return (
    <BaseLayout admin={loaderData?.admin ?? false} footer={footer}>
      <Outlet />
    </BaseLayout>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  // WordPress probe decoy: `notWordPressSite()` throws a 404 Response whose
  // `statusText` we use as the marker. Render the dedicated view so scanners
  // see "this is not a WordPress site" instead of the generic "未找到页面".
  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return (
      <BaseLayout admin={loaderData?.admin ?? false}>
        <NotWordPressView />
      </BaseLayout>
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
    <BaseLayout admin={loaderData?.admin ?? false}>
      <div className="flex h-[50vh] flex-1 flex-col text-center">
        <div className="my-auto">
          <h1 className="text-[6rem]">{title === '未找到页面' ? '404' : '500'}</h1>
          <div>{description}</div>
        </div>
      </div>
    </BaseLayout>
  )
}
