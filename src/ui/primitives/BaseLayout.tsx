import type { ReactNode } from 'react'

import type { NavigationItem } from '@/shared/blog-config'

import { useNavigationSettings } from '@/ui/lib/blog-config-context'
import { Footer } from '@/ui/primitives/Footer'
import { Header } from '@/ui/primitives/Header'
import { ScrollTopButton } from '@/ui/primitives/ScrollTopButton'

// NOTE: this component does NOT import `public.css`. The public stylesheet
// cascade lives one level up in `@/ui/primitives/PublicChrome` so it can be
// reached through a *static* import from `routes/public.layout.tsx` (which
// in turn lets React Router include the resolved `<link rel="stylesheet">`
// tags in the SSR `<Links />` output, preventing FOUC on first paint).
//
// Importing `public.css` here would re-attach the Bootstrap reboot/grid/
// utility cascade to every consumer of `<BaseLayout>` — including the
// `<BaseLayout>` rendered by the root `ErrorBoundary`'s lazy chunk — and
// would drag those bytes into the wp-admin SPA chunk through that lazy
// graph. Keep this file CSS-free; mount `<PublicChrome>` instead when you
// need both the chrome AND the public stylesheet.

export interface BaseLayoutProps {
  navigation?: NavigationItem[]
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
  const navigationSection = useNavigationSettings()
  const showFooter = footer !== undefined ? footer : true
  const resolvedNavigation = navigation || navigationSection.navigation

  // Body chrome layout. The `<lg` viewport stacks the sidebar above
  // the main column (`flex-direction: column`); from `lg` upward they
  // sit side-by-side (`flex-direction: row`). The `<main>` flexes to
  // fill all remaining inline space (`flex: 1 1 auto`).
  return (
    <div className="flex flex-col lg:flex-row">
      <Header navigation={resolvedNavigation} admin={admin} />
      <main className="flex flex-1 flex-col">
        {children}
        {showFooter && <Footer />}
      </main>
      {/*
        Fixed-position widget rail anchored bottom-right. Replaces the
        legacy `.site-fixed-widget { position: fixed; right: 20px;
        bottom: 0; transform: translateY(-50%); display: block;
        z-index: 9999 }` rule. `display: block` is the `<ul>` browser
        default, dropped per Lesson 1. The `9999` z-index is the
        legacy "above everything" value — kept as the literal
        `z-[9999]` because no other public widget needs to sit at
        the same layer (Lesson 8 — sole consumer; promoting it to a
        named token would only buy verbosity). The `site-fixed-widget`
        literal is preserved as a WP-compat marker.

        The legacy `.site-fixed-widget li { margin: 0 0 1rem }`
        per-item bottom-spacing rule is dead today: the only `<li>`
        in this `<ul>` is `<ScrollTopButton>` (which always also
        matches `.fixed-gotop` and overrides `margin: 0`). Inlined
        as a no-op (`<li>` already has `margin: 0` via reset.css's
        un-layered `li { margin: 0 }` rule).
      */}
      <ul className="site-fixed-widget fixed right-5 bottom-0 z-[9999] -translate-y-1/2">
        <ScrollTopButton />
      </ul>
    </div>
  )
}
