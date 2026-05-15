import type { ReactElement, ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Buffer } from 'node:buffer'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { prerenderToNodeStream } from 'react-dom/static'
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router'

import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { ThemeProvider } from '@/ui/lib/ThemeProvider'

import { TEST_BLOG_SETTINGS_BUNDLE } from './blog-settings'

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

/** Synchronously render a React element to an HTML string. */
export function renderToHtml(element: ReactElement): string {
  return renderToString(
    <QueryClientProvider client={makeTestQueryClient()}>
      <ThemeProvider>
        <BlogSettingsProvider value={TEST_BLOG_SETTINGS_BUNDLE}>{element}</BlogSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

// Render a component tree under a memory router so React Router 7 hooks
// (`useLocation`, `useHref`, `useFetcher`, `<Link>`, …) can resolve.
export function renderInRouter(node: ReactNode, initialPath: string = '/'): string {
  const routes: RouteObject[] = [{ path: '*', element: <>{node}</> }]
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return renderToStaticMarkup(
    <QueryClientProvider client={makeTestQueryClient()}>
      <ThemeProvider>
        <BlogSettingsProvider value={TEST_BLOG_SETTINGS_BUNDLE}>
          <RouterProvider router={router} />
        </BlogSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

export async function prerenderToHtml(element: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    <QueryClientProvider client={makeTestQueryClient()}>
      <ThemeProvider>
        <BlogSettingsProvider value={TEST_BLOG_SETTINGS_BUNDLE}>{element}</BlogSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
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
