import { DateTime } from 'luxon'

import config from '@/blog.config'

export function Footer() {
  const thisYear = DateTime.now().setZone(config.settings.timeZone).year
  const { icpNo, moeIcpNo, initialYear } = config.settings.footer
  const hasIcp = icpNo || moeIcpNo

  return (
    <footer className="footer border-top border-light text-xs text-center py-4 py-xl-5">
      <div className="line">
        <span>
          Copyright © {initialYear}-{thisYear}{' '}
        </span>
        <a href={config.website} title={config.title} rel="home">
          {config.title}
        </a>
      </div>
      {hasIcp && (
        <div className="line">
          {icpNo && (
            <a href="https://beian.miit.gov.cn" rel="nofollow" target="_blank" title="ICP 备案">
              {icpNo}
            </a>
          )}
          {moeIcpNo && (
            <a
              href={`https://icp.gov.moe/?keyword=${config.website.replace(/^https?:\/\//, '')}`}
              rel="nofollow"
              target="_blank"
              title="萌国 ICP 备案"
            >
              {moeIcpNo}
            </a>
          )}
        </div>
      )}
    </footer>
  )
}
