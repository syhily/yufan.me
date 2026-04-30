import type { ReactNode } from 'react'

import config, { type BlogConfig } from '@/blog.config'
import { Footer } from '@/ui/primitives/Footer'
import { Header } from '@/ui/primitives/Header'
import { ScrollTopButton } from '@/ui/primitives/ScrollTopButton'
// `globals.css` is the public site's complete cascade (Bootstrap reboot/grid/
// utilities, hand-written `_base.css`/`_widgets.css`/`_comments.css`, and
// Tailwind v4 with the `tw:` prefix). Keep the import colocated with the
// only component that ever renders that chrome so the wp-admin SPA chunk
// (which lazy-loads nothing from this file) stays Bootstrap-free.
import '@/assets/styles/globals.css'

export interface BaseLayoutProps {
  navigation?: BlogConfig['navigation']
  footer?: boolean
  admin: boolean
  children?: ReactNode
}

// Body-chrome wrapper: header + main region + fixed widgets. The wrapping
// `<html>`, `<head>`, and `<body>` live in `root.tsx`'s `Layout` export.
//
// Exported so `tests/snapshot.layout.test.tsx` can render the chrome in
// isolation; production callers should rely on the default `<App>` export
// from `@/root` rather than instantiating `BaseLayout` directly.
export function BaseLayout({ navigation, footer, admin, children }: BaseLayoutProps) {
  const showFooter = footer !== undefined ? footer : true
  const resolvedNavigation = navigation || config.navigation

  return (
    <div className="site-layout">
      <Header navigation={resolvedNavigation} admin={admin} />
      <main className="site-main">
        {children}
        {showFooter && <Footer />}
      </main>
      <ul className="site-fixed-widget">
        <ScrollTopButton />
      </ul>
    </div>
  )
}
