import { useRouteLoaderData } from 'react-router'

import { NavLink } from '@/ui/primitives/NavLink'
import { useSiteConfig } from '@/ui/primitives/site-config'

const lineClass = 'mt-[3px] flex flex-row flex-wrap justify-center gap-[0.5em]'
const linkClass = 'text-foreground hover:text-accent'

export interface FooterProps {
  /**
   * Current calendar year. When omitted, the component reads it from the
   * root route loader (`{ admin, currentYear }`) via
   * `useRouteLoaderData('root')`. Either way, the value is sourced from
   * the server so SSR and CSR agree across the New-Year boundary —
   * `new Date().getFullYear()` inside render would mismatch when the
   * server renders Dec 31 23:59 UTC and the client hydrates as Jan 1
   * 00:00 local.
   */
  currentYear?: number
}

interface RootLoaderShape {
  currentYear?: number
}

export function Footer({ currentYear }: FooterProps) {
  const config = useSiteConfig()
  const rootData = useRouteLoaderData('root') as RootLoaderShape | undefined
  const year = currentYear ?? rootData?.currentYear ?? new Date().getFullYear()
  const { icpNo, moeIcpNo, initialYear } = config.settings.footer
  const hasIcp = icpNo || moeIcpNo

  return (
    <footer className="border-t border-border text-xs text-center py-4 xl:py-5">
      <div className={lineClass}>
        <span>
          Copyright © {initialYear}-{year}{' '}
        </span>
        {/*
          The site-root link is the canonical "home" anchor and stays
          a plain `<a rel="home" href={config.website}>` rather than a
          NavLink: `rel="home"` is a typed link relation that
          accessibility tooling reads, NavLink's `<Link>` branch
          can't carry a custom `rel`, and the click is a same-tab
          full-document load anyway.
        */}
        <a className={linkClass} href={config.website} title={config.title} rel="home">
          {config.title}
        </a>
      </div>
      {hasIcp && (
        <div className={lineClass}>
          {icpNo && (
            <NavLink className={linkClass} href="https://beian.miit.gov.cn" title="ICP 备案">
              {icpNo}
            </NavLink>
          )}
          {moeIcpNo && (
            <NavLink
              className={linkClass}
              href={`https://icp.gov.moe/?keyword=${config.website.replace(/^https?:\/\//, '')}`}
              title="萌国 ICP 备案"
            >
              {moeIcpNo}
            </NavLink>
          )}
        </div>
      )}
    </footer>
  )
}
