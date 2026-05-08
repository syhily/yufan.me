import { formatLocalDate } from '@/shared/formatter'
import { useFooterSettings, useSiteIdentity } from '@/ui/lib/blog-config-context'

export function Footer() {
  const siteIdentity = useSiteIdentity()
  const { website, title } = siteIdentity
  const { footer } = useFooterSettings()
  const thisYear = formatLocalDate(new Date(), 'yyyy', siteIdentity)
  const { icpNo, moeIcpNo, initialYear } = footer
  const hasIcp = icpNo || moeIcpNo

  return (
    <footer className="mt-4 flex flex-1 flex-col items-center justify-center gap-1 border-t border-line py-6 text-center text-xs md:mt-4 md:py-8 lg:mt-5 lg:py-10">
      <div className="flex flex-row flex-wrap justify-center gap-[0.5em]">
        <span>
          Copyright © {initialYear}-{thisYear}{' '}
        </span>
        <a href={website} title={title} rel="home" className="text-ink-strong hover:text-brand">
          {title}
        </a>
      </div>
      {hasIcp && (
        <div className="flex flex-row flex-wrap justify-center gap-[0.5em]">
          {icpNo && (
            <a
              href="https://beian.miit.gov.cn"
              rel="nofollow noreferrer"
              target="_blank"
              title="ICP 备案"
              className="text-ink-strong hover:text-brand"
            >
              {icpNo}
            </a>
          )}
          {moeIcpNo && (
            <a
              href={`https://icp.gov.moe/?keyword=${website.replace(/^https?:\/\//, '')}`}
              rel="nofollow noreferrer"
              target="_blank"
              title="萌国 ICP 备案"
              className="text-ink-strong hover:text-brand"
            >
              {moeIcpNo}
            </a>
          )}
        </div>
      )}
    </footer>
  )
}
