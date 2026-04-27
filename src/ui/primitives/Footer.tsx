import config from '@/blog.config'
import { formatLocalDate } from '@/shared/formatter'

const lineClass = 'mt-[3px] flex flex-row flex-wrap justify-center gap-[0.5em]'
const linkClass = 'text-foreground hover:text-accent'

export function Footer() {
  const thisYear = formatLocalDate(new Date(), 'yyyy')
  const { icpNo, moeIcpNo, initialYear } = config.settings.footer
  const hasIcp = icpNo || moeIcpNo

  return (
    <footer className="border-t border-border text-xs text-center py-4 xl:py-5">
      <div className={lineClass}>
        <span>
          Copyright © {initialYear}-{thisYear}{' '}
        </span>
        <a className={linkClass} href={config.website} title={config.title} rel="home">
          {config.title}
        </a>
      </div>
      {hasIcp && (
        <div className={lineClass}>
          {icpNo && (
            <a
              className={linkClass}
              href="https://beian.miit.gov.cn"
              rel="nofollow noreferrer"
              target="_blank"
              title="ICP 备案"
            >
              {icpNo}
            </a>
          )}
          {moeIcpNo && (
            <a
              className={linkClass}
              href={`https://icp.gov.moe/?keyword=${config.website.replace(/^https?:\/\//, '')}`}
              rel="nofollow noreferrer"
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
