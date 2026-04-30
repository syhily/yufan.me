import { isRouteErrorResponse, Outlet, useMatches, useRouteLoaderData } from 'react-router'

import type { RouteHandle } from '@/root'

import { NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'
import { NotWordPressView } from '@/ui/post/NotWordPressView'
import { PublicChrome } from '@/ui/primitives/PublicChrome'

import type { Route } from './+types/public.layout'

// Pathless layout that wraps every public-facing route. It exists for two
// reasons:
//
//   1. STATIC CSS GRAPH. `PublicChrome` statically imports `globals.css`
//      (Bootstrap reboot/grid/utilities, hand-written `_base.css` /
//      `_widgets.css` / `_comments.css`, plus Tailwind v4). Because this
//      module is statically imported by the route manifest, React Router
//      can include the compiled stylesheet in the SSR `<Links />` output
//      for every public URL — so the first paint is fully styled instead
//      of flashing un-styled DOM while a `React.lazy()` chunk downloads.
//
//   2. ADMIN ISOLATION. The wp-admin SPA (and the legacy login/install
//      split-screen) sit OUTSIDE this layout, so neither React Router nor
//      Vite ever pulls `globals.css` into their chunks. The admin routes
//      already own their own chrome through `routes/wp-admin.layout.tsx`
//      and `routes/admin.layout.tsx`.
//
// Routes that need to opt out of the site footer (e.g. the page-detail
// route) keep using the `handle.footer = false` convention defined on
// `RouteHandle`. We aggregate those flags from every matched descendant
// route so the closest opt-out wins, matching the behaviour the previous
// `<App>` component implemented inside `root.tsx`.

function useResolvedChromeProps(): { admin: boolean; footer: boolean } {
  const matches = useMatches()
  const rootData = useRouteLoaderData('root') as { admin?: boolean } | undefined
  const admin = rootData?.admin ?? false

  const footer = matches.reduce<boolean>((acc, match) => {
    const handle = match.handle as RouteHandle | undefined
    if (handle?.footer === false) return false
    return acc
  }, true)

  return { admin, footer }
}

export default function PublicLayoutRoute() {
  const { admin, footer } = useResolvedChromeProps()

  return (
    <PublicChrome admin={admin} footer={footer}>
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
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { admin, footer } = useResolvedChromeProps()

  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return (
      <PublicChrome admin={admin} footer={footer}>
        <NotWordPressView />
      </PublicChrome>
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
    <PublicChrome admin={admin} footer={footer}>
      <div className="data-null">
        <div className="my-auto">
          <h1 className="font-number">{title === '未找到页面' ? '404' : '500'}</h1>
          <div>{description}</div>
        </div>
      </div>
    </PublicChrome>
  )
}
