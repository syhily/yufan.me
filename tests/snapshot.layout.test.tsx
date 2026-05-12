import { describe, expect, it } from 'vite-plus/test'

import { BaseLayout } from '@/ui/primitives/BaseLayout'

import { renderInRouter } from './_helpers/render'

// BaseLayout is the chrome shared by every page (header, main, fixed
// widgets). Snapshot it in its three primary configurations so any
// markup drift surfaces as a PR diff. `renderInRouter` from the shared
// helper wires both the memory router (so `Header`'s `useLocation`
// resolves) and the `BlogSettingsProvider` (so per-section hooks like `useNavigationSettings`
// resolves to `TEST_BLOG_SETTINGS`).

describe('snapshot: BaseLayout shell', () => {
  it('renders the default chrome (footer on, non-admin)', () => {
    const html = renderInRouter(
      <BaseLayout admin={false} pathname="/" search="">
        <div className="page-body">page body</div>
      </BaseLayout>,
      '/',
    )
    expect(html).toMatchSnapshot()
  })

  it('renders without the footer when explicitly disabled (page detail)', () => {
    const html = renderInRouter(
      <BaseLayout admin={false} footer={false} pathname="/about" search="">
        <div className="page-body">about body</div>
      </BaseLayout>,
      '/about',
    )
    expect(html).toMatchSnapshot()
  })

  it('renders the admin variant of the chrome', () => {
    const html = renderInRouter(
      <BaseLayout admin pathname="/posts/hello" search="">
        <div className="page-body">post body</div>
      </BaseLayout>,
      '/posts/hello',
    )
    expect(html).toMatchSnapshot()
  })
})
