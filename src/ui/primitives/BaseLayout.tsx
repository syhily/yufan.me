import type { ReactNode } from 'react'

import type { BlogConfig } from '@/blog.config'

import { useBlogConfig } from '@/ui/lib/blog-config-context'
import { Footer } from '@/ui/primitives/Footer'
import { Header } from '@/ui/primitives/Header'
import { ScrollTopButton } from '@/ui/primitives/ScrollTopButton'

// NOTE: this component does NOT import `globals.css`. The public stylesheet
// cascade lives one level up in `@/ui/primitives/PublicChrome` so it can be
// reached through a *static* import from `routes/public.layout.tsx` (which
// in turn lets React Router include the resolved `<link rel="stylesheet">`
// tags in the SSR `<Links />` output, preventing FOUC on first paint).
//
// Importing `globals.css` here would re-attach the Bootstrap reboot/grid/
// utility cascade to every consumer of `<BaseLayout>` — including the
// `<BaseLayout>` rendered by the root `ErrorBoundary`'s lazy chunk — and
// would drag those bytes into the wp-admin SPA chunk through that lazy
// graph. Keep this file CSS-free; mount `<PublicChrome>` instead when you
// need both the chrome AND the public stylesheet.

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
  const config = useBlogConfig()
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
