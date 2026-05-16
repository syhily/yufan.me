import { Outlet, useLocation, useMatches, useRouteLoaderData } from 'react-router'

import type { RouteHandle } from '@/root'

import { useReloadOnChunkError } from '@/client/hooks/use-chunk-error-recovery'
import { ErrorView } from '@/ui/public/chrome/ErrorView'
import { PublicChrome } from '@/ui/public/chrome/PublicChrome'

import type { Route } from './+types/layout'

// Pathless layout that wraps every public-facing route. It exists for two
// reasons:
//
//   1. STATIC CSS GRAPH. `PublicChrome` statically imports `public.css`
//      (Bootstrap reboot/grid/utilities, the hand-written component
//      partials — eight under `@/ui/primitives/*.css` plus three
//      colocated under `@/ui/{post,sidebar,comments}/*.css` — plus
//      Tailwind v4). Because this
//      module is statically imported by the route manifest, React Router
//      can include the compiled stylesheet in the SSR `<Links />` output
//      for every public URL — so the first paint is fully styled instead
//      of flashing un-styled DOM while a `React.lazy()` chunk downloads.
//
//   2. ADMIN ISOLATION. The wp-admin SPA (and the legacy login/install
//      split-screen) sit OUTSIDE this layout, so neither React Router nor
//      Vite ever pulls `public.css` into their chunks. The admin routes
//      already own their own chrome through `routes/wp-admin.layout.tsx`
//      and `routes/admin.layout.tsx`.
//
// Routes that need to opt out of the site footer (e.g. the page-detail
// route) keep using the `handle.footer = false` convention defined on
// `RouteHandle`. We aggregate those flags from every matched descendant
// route so the closest opt-out wins, matching the behaviour the previous
// `<App>` component implemented inside `root.tsx`.

interface RootChromeData {
  currentUser?: { id: string; name: string; role: 'admin' | 'author' | 'visitor' } | null
}

function useResolvedChromeProps(): {
  currentUser: NonNullable<RootChromeData['currentUser']> | null
  footer: boolean
} {
  const matches = useMatches()
  const rootData = useRouteLoaderData('root') as RootChromeData | undefined
  const currentUser = rootData?.currentUser ?? null

  const footer = matches.reduce<boolean>((acc, match) => {
    const handle = match.handle as RouteHandle | undefined
    if (handle?.footer === false) {
      return false
    }
    return acc
  }, true)

  return { currentUser, footer }
}

export default function PublicLayoutRoute() {
  const { currentUser, footer } = useResolvedChromeProps()
  const { pathname, search } = useLocation()

  return (
    <PublicChrome currentUser={currentUser} footer={footer} pathname={pathname} search={search}>
      <Outlet />
    </PublicChrome>
  )
}

// `ErrorBoundary` lives on this layout (not just on `root`) so that 404s
// thrown by `routes/not-found.tsx` and slug-miss `notFound()` calls inside
// public route loaders still render INSIDE `<PublicChrome>` synchronously.
// Without it the error would bubble up to the root boundary, which can only
// reach the chrome through a lazy chunk and would re-introduce the FOUC
// this whole layout was built to fix.
//
// Body decision is shared with `src/root.tsx`'s boundary through
// `<ErrorView />`; the only difference here is that we wrap the body
// in the synchronous `<PublicChrome>` instead of the lazy variant.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Chunk-load errors thrown during render of a child route bubble
  // up to this boundary -- recover the same way `App` does for
  // unhandled rejections, before falling through to the normal
  // `<ErrorView />` render path for non-chunk errors.
  useReloadOnChunkError(error)

  const { currentUser, footer } = useResolvedChromeProps()
  const { pathname, search } = useLocation()

  return (
    <PublicChrome currentUser={currentUser} footer={footer} pathname={pathname} search={search}>
      <ErrorView error={error} isDev={import.meta.env.DEV} />
    </PublicChrome>
  )
}
