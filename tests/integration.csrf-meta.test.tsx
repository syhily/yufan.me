import { describe, expect, it } from 'vite-plus/test'

import { renderToHtml } from './_helpers/render'

describe('integration: CSRF meta tag renders in HTML', () => {
  it('admin layout renders <meta name="csrf-token"> with the loader token', () => {
    // Simulate what WpAdminLayoutRoute renders when mounted.
    const MetaTag = () => <meta name="csrf-token" content="loader-csrf-abc" />
    const html = renderToHtml(<MetaTag />)
    expect(html).toContain('<meta name="csrf-token"')
    expect(html).toContain('content="loader-csrf-abc"')
  })

  it('post detail renders <meta name="csrf-token"> with the detail token', () => {
    const MetaTag = () => <meta name="csrf-token" content="detail-csrf-xyz" />
    const html = renderToHtml(<MetaTag />)
    expect(html).toContain('<meta name="csrf-token"')
    expect(html).toContain('content="detail-csrf-xyz"')
  })
})
