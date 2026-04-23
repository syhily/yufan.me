import type { AstroSession } from 'astro'
import type { ReactNode } from 'react'

import config, { type BlogConfig } from '@/blog.config'
import { Icon } from '@/components/icons/Icon'
import { Footer } from '@/components/partial/Footer'
import { Header } from '@/components/partial/Header'

export interface BaseLayoutProps {
  navigation?: BlogConfig['navigation']
  footer?: boolean
  /** `Astro.session` forwarded from the page shell — Header reads admin state from it. */
  session: AstroSession | undefined
  /** Used by Header to build the post-logout redirect URL. */
  currentPath: string
  children?: ReactNode
}

// Body-chrome wrapper: header + main region + fixed widgets. The wrapping
// `<html>`, `<head>`, and `<body>` live in `BaseLayout.astro`, which owns the
// global CSS / client-script side-effects that only Astro can express.
export function BaseLayout({ navigation, footer, session, currentPath, children }: BaseLayoutProps) {
  const showFooter = footer !== undefined ? footer : true
  const resolvedNavigation = navigation || config.navigation

  return (
    <div className="site-layout">
      <Header navigation={resolvedNavigation} session={session} currentPath={currentPath} />
      <main className="site-main">
        {children}
        {showFooter && <Footer />}
      </main>
      <ul className="site-fixed-widget">
        <li className="fixed-gotop">
          <div className="btn btn-light btn-icon btn-lg btn-rounded btn-gotop">
            <span>
              <Icon name="arrowup" />
            </span>
          </div>
        </li>
      </ul>
    </div>
  )
}
