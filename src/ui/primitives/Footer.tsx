import { formatLocalDate } from '@/shared/formatter'
import { useFooterSettings, useLocalization, useSiteIdentity } from '@/ui/lib/blog-config-context'

export function Footer() {
  const { website, title } = useSiteIdentity()
  const localization = useLocalization()
  const { footer } = useFooterSettings()
  const thisYear = formatLocalDate(new Date(), 'yyyy', localization)
  const { icpNo, moeIcpNo, initialYear } = footer
  const hasIcp = icpNo || moeIcpNo

  return (
    <footer className="footer border-top border-light text-xs text-center py-4 py-xl-5">
      <div className="line">
        <span>
          Copyright © {initialYear}-{thisYear}{' '}
        </span>
        <a href={website} title={title} rel="home">
          {title}
        </a>
      </div>
      {hasIcp && (
        <div className="line">
          {icpNo && (
            <a href="https://beian.miit.gov.cn" rel="nofollow noreferrer" target="_blank" title="ICP 备案">
              {icpNo}
            </a>
          )}
          {moeIcpNo && (
            <a
              href={`https://icp.gov.moe/?keyword=${website.replace(/^https?:\/\//, '')}`}
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
