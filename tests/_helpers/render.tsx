import type { ReactElement, ReactNode } from 'react'

import { Buffer } from 'node:buffer'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { prerenderToNodeStream } from 'react-dom/static'
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router'

import config from '@/blog.config'
import { SiteConfigProvider } from '@/ui/primitives/site-config'

// Tiny SSR helpers shared across snapshot tests so each spec doesn't have to
// know whether it should reach for `renderToString` (synchronous, no Suspense
// boundary needed) or `prerenderToNodeStream` (the path the RSS/Atom feed
// pipeline uses when it still needs an HTML string).
//
// Each helper wraps the tree in `<SiteConfigProvider>` so domain components
// that read site metadata via `useSiteConfig()` (Sidebar's calendar widget,
// Header's title/socials, Footer's copyright, …) work the same way they
// would under the production `<BaseLayout>`.

/** Synchronously render a React element to an HTML string. */
export function renderToHtml(element: ReactElement): string {
  return renderToString(<SiteConfigProvider value={config}>{element}</SiteConfigProvider>)
}

// Render a component tree under a memory router so React Router 7 hooks
// (`useLocation`, `useHref`, `useFetcher`, `<Link>`, …) can resolve. The
// memory router is configured with a single catch-all route so the snapshot
// matches what the SSR runtime would produce for `initialPath`.
export function renderInRouter(node: ReactNode, initialPath: string = '/'): string {
  const routes: RouteObject[] = [{ path: '*', element: <SiteConfigProvider value={config}>{node}</SiteConfigProvider> }]
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

/**
 * Stream-render a React tree the way our production SSR pipeline does, then
 * collect the result into a single string. Useful for snapshot-testing
 * components that depend on Suspense / server-only data fetching.
 */
export async function prerenderToHtml(element: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(<SiteConfigProvider value={config}>{element}</SiteConfigProvider>)
  const chunks: Buffer[] = []
  for await (const chunk of prelude) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Strip volatile React server attributes (`data-react-*`, hydration markers,
 * source-map URL fragments) so snapshots survive React minor upgrades.
 * Pure regex-based; does not rebuild the DOM.
 */
export function stableHtml(html: string): string {
  return html
    .replace(/\s+data-react[\w-]+="[^"]*"/g, '')
    .replace(/<!--\$-->|<!--\/\$-->|<!--\$\?-->|<!--\$!-->|<!---->/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
