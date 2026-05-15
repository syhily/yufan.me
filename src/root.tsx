import type { ShouldRevalidateFunctionArgs } from 'react-router'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router'

import { useChunkErrorRecovery, useReloadOnChunkError } from '@/client/hooks/use-chunk-error-recovery'
import { FocusHashProvider } from '@/client/hooks/use-focus-hash'
import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { getBlogSettingsBundleSync } from '@/shared/blog-config'
import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { ThemeProvider, THEME_COOKIE } from '@/ui/lib/ThemeProvider'
import { ChunkReloadOverlay } from '@/ui/public/chrome/ChunkReloadOverlay'
import { ErrorView } from '@/ui/public/chrome/ErrorView'
import { NavigationSplash } from '@/ui/public/chrome/NavigationSplash'

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
// `@/ui/public/chrome/PublicChrome` or `@/ui/public/chrome/BaseLayout`) from
// this module. A re-export pins the live binding statically and would
// drag `public.css` into every route chunk, breaking the cascade
// contract documented in `tailwind.css` (#admin-buttons-no-padding).
const PublicChromeLazy = lazy(() =>
  import('@/ui/public/chrome/PublicChrome').then((m) => ({ default: m.PublicChrome })),
)

// Session, install gate, and visitor cookie are handled by Hono
// middleware at the HTTP perimeter (see src/entry/server.node.ts).
// The Hono bridge copies session/viewer into React Router context so
// loaders can read them via getRouteRequestContext(). No RR-level
// middleware is needed — adding it would double-resolve the session
// and re-run install-gate DB queries on every page request.
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

export function loader({ request, context }: Route.LoaderArgs) {
  const { role, user } = getRouteRequestContext({ request, context })
  const admin = role === 'admin'
  // Project the authenticated user (if any) to the slim shape the
  // public chrome's UserMenu needs. Don't ship the whole SessionUser —
  // email and badge fields belong on the profile page, not in the
  // navigation bar payload.
  const currentUser = user && role ? { id: user.id, name: user.name, role } : null

  // Read the theme cookie so the SSR <html> tag carries the correct
  // class before the client bundle loads — no inline scripts needed.
  // When no cookie is present we deliberately render `<html>` without
  // a theme class so the CSS `@media (prefers-color-scheme: dark)`
  // fallback in tailwind.css can resolve the right palette for
  // noscript users. ThemeProvider sets an explicit class after
  // hydration, after which cookie precedence applies on every
  // subsequent request.
  const cookie = request.headers.get('Cookie') ?? ''
  const themeMatch = cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`))
  const cookieValue = themeMatch?.[1]
  const theme: 'dark' | 'light' | null = cookieValue === 'dark' ? 'dark' : cookieValue === 'light' ? 'light' : null

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

  return { admin, currentUser, blogSettings, theme }
}

// The root loader ships `{ admin, blogSettings }`. Both can change at
// runtime: `admin` flips on three POST endpoints (login, install,
// logout); `blogSettings` flips whenever an admin saves a settings page.
// Revalidate when any of those actions submit, plus when an admin
// settings save fires from `/api/admin/settings` (the
// settings layout already calls `useRevalidator()`, but admin saves
// going through other tabs need this safety net too).
export function shouldRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (
    formAction &&
    (formAction.startsWith('/wp-login.php') ||
      formAction.startsWith('/wp-admin/install') ||
      formAction.startsWith('/api/admin/settings'))
  ) {
    return defaultShouldRevalidate
  }
  return false
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Pull both the theme cookie and the admin-configured site-wide font
  // CSS URLs off the root loader data. `fonts` is null when the
  // settings row hasn't been seeded yet (pre-install) — in that
  // case `globalCss` is `[]` and no font `<link>` is emitted, so the
  // page falls back to the system-stack fonts declared in
  // `tailwind.css` without any pre-paint flash.
  const rootData = useRouteLoaderData<{
    theme?: 'dark' | 'light' | null
    blogSettings?: { fonts?: { globalCss?: string[] } | null } | null
  }>('root')
  const theme = rootData?.theme ?? null
  const globalFontCss = rootData?.blogSettings?.fonts?.globalCss ?? []

  return (
    <html lang="zh-CN" className={theme ?? undefined}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content={theme ?? 'light dark'} />
        {globalFontCss.map((url) => (
          <link key={url} rel="stylesheet" href={url} />
        ))}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ChunkReloadOverlay />
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
  useIosNoZoomOnFocus()
  useChunkErrorRecovery()

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialResolved={loaderData.theme ?? undefined}>
        <BlogSettingsProvider value={loaderData.blogSettings ?? undefined}>
          <FocusHashProvider>
            <NavigationSplash />
            <Outlet />
          </FocusHashProvider>
        </BlogSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  useReloadOnChunkError(error)

  const blogSettings = loaderData?.blogSettings ?? getBlogSettingsBundleSync()

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: false },
        },
      }),
  )

  const body = <ErrorView error={error} isDev={import.meta.env.DEV} />

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialResolved={loaderData?.theme ?? undefined}>
        <BlogSettingsProvider value={blogSettings ?? undefined}>
          <Suspense fallback={null}>
            {blogSettings ? (
              <PublicChromeLazy currentUser={loaderData?.currentUser ?? null} pathname="/" search="">
                {body}
              </PublicChromeLazy>
            ) : (
              body
            )}
          </Suspense>
        </BlogSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
