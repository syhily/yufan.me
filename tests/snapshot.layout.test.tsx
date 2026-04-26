import type { ReactNode } from 'react'

import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vite-plus/test'

import { BaseLayout } from '@/root'

// BaseLayout is the chrome shared by every page (header, main, fixed
// widgets). Snapshot it in its three primary configurations so any
// markup drift surfaces as a PR diff.

// `Header` reads `useLocation()` directly, so the snapshot must render under
// a router. A memory router with a single route at `initialPath` faithfully
// reproduces what the SSR runtime would feed `Header` for that URL.
function renderInRouter(node: ReactNode, initialPath: string): string {
  const router = createMemoryRouter([{ path: '*', element: <>{node}</> }], {
    initialEntries: [initialPath],
  })
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

describe('snapshot: BaseLayout shell', () => {
  it('renders the default chrome (footer on, non-admin)', () => {
    const html = renderInRouter(
      <BaseLayout admin={false}>
        <div className="page-body">page body</div>
      </BaseLayout>,
      '/',
    )
    expect(html).toMatchSnapshot()
  })

  it('renders without the footer when explicitly disabled (page detail)', () => {
    const html = renderInRouter(
      <BaseLayout admin={false} footer={false}>
        <div className="page-body">about body</div>
      </BaseLayout>,
      '/about',
    )
    expect(html).toMatchSnapshot()
  })

  it('renders the admin variant of the chrome', () => {
    const html = renderInRouter(
      <BaseLayout admin>
        <div className="page-body">post body</div>
      </BaseLayout>,
      '/posts/hello',
    )
    expect(html).toMatchSnapshot()
  })
})
