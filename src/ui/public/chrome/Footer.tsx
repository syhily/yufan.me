import type { FooterNavItem } from '@/shared/config/blog'
import type { SocialNetwork } from '@/shared/config/socials'

import { formatLocalDate } from '@/shared/utils/formatter'
import { Button } from '@/ui/components/button'
import { IconButtonContent } from '@/ui/components/icon-button-content'
import { SOCIAL_NETWORK_ICONS } from '@/ui/icons/social-icons'
import { useFooterSettings, useSiteIdentity, useSocialsSettings } from '@/ui/lib/blog-config-context'
import { ThemeToggle } from '@/ui/public/chrome/ThemeToggle'
import { SearchIconButton } from '@/ui/public/Search'
import { QRDialog } from '@/ui/public/widgets/QRDialog'

function SocialNavIcon({ network, className }: { network: SocialNetwork; className?: string }) {
  const Icon = SOCIAL_NETWORK_ICONS[network]
  return <Icon className={className} />
}

function FooterNavItemRender({ item }: { item: FooterNavItem }) {
  const { socials } = useSocialsSettings()

  if (item.type === 'themeToggle') {
    return <ThemeToggle mode="public" />
  }

  if (item.type === 'search') {
    return <SearchIconButton />
  }

  if (item.type === 'social' && item.network) {
    const social = socials.find((s) => s.network === item.network)
    if (!social) {
      return null
    }

    if (social.type === 'qrcode') {
      return (
        <QRDialog
          key={social.name}
          url={social.link}
          name={social.name}
          title={social.title ?? social.name}
          trigger={<SocialNavIcon network={social.network} className="m-icon-inset" />}
        />
      )
    }

    return (
      <Button
        key={social.name}
        variant="dark"
        size="iconSm"
        shape="circle"
        className="mr-2"
        // oxlint-disable-next-line jsx-a11y/anchor-has-content
        render={<a href={social.link} target="_blank" rel="noreferrer" />}
        title={social.title ?? social.name}
      >
        <IconButtonContent>
          <SocialNavIcon network={social.network} className="m-icon-inset" />
        </IconButtonContent>
      </Button>
    )
  }

  return null
}

export function Footer() {
  const siteIdentity = useSiteIdentity()
  const { website, title } = siteIdentity
  const { footer } = useFooterSettings()
  const thisYear = formatLocalDate(new Date(), 'yyyy', siteIdentity)
  const { icpNo, moeIcpNo, initialYear, items } = footer
  const hasIcp = icpNo || moeIcpNo
  const hasNavItems = items && items.length > 0

  return (
    <footer className="mt-4 flex flex-1 flex-col items-center justify-center gap-1 border-t border-line py-6 text-center text-xs md:mt-4 md:py-8 lg:mt-5 lg:py-10">
      {hasNavItems && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {items.map((item, index) => (
            <FooterNavItemRender key={`${item.type}-${item.network ?? index}`} item={item} />
          ))}
        </div>
      )}
      <div className="flex flex-row flex-wrap justify-center gap-[0.5em]">
        <span>
          Copyright © {initialYear}-{thisYear}{' '}
        </span>
        <a href={website} title={title} rel="home" className="text-ink-1 hover:text-brand">
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
              className="text-ink-1 hover:text-brand"
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
              className="text-ink-1 hover:text-brand"
            >
              {moeIcpNo}
            </a>
          )}
        </div>
      )}
    </footer>
  )
}
