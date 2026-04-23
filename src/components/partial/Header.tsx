import { Icon } from '@/assets/icons/Icon'
import config, { type BlogConfig } from '@/blog.config'
import { AdminBlock } from '@/components/partial/AdminBlock'
import { QRDialog } from '@/components/partial/QRDialog'
import { SearchIcon } from '@/components/search/SearchIcon'

export interface HeaderProps {
  navigation: BlogConfig['navigation']
  admin: boolean
  /** Current pathname used for the `redirect_to` after logout. */
  currentPath: string
}

export function Header({ navigation, admin, currentPath }: HeaderProps) {
  const logoutQuery = new URLSearchParams({ action: 'logout', redirect_to: currentPath }).toString()

  return (
    <>
      <header className="site-aside">
        <div className="aside-overlay" />
        <div className="aside-inner bg-secondary">
          <h1 className="navbar-brand">
            <a href="/" title={config.title} className="d-block">
              <img src="/logo-dark.svg" alt="且听书吟" />
            </a>
          </h1>
          <div className="site-menu">
            <ul>
              {navigation.map((menu, i) => (
                <li id={`menu-item-${i}`} key={`menu-${i}`} className={`menu-item${i === 0 ? ' menu-item-home' : ''}`}>
                  <a href={menu.link} target={menu.target}>
                    {menu.text}
                  </a>
                </li>
              ))}
              <AdminBlock admin={admin}>
                <li id={`menu-item-${navigation.length}`} className="menu-item">
                  <a href="/wp-admin/">评论</a>
                </li>
                <li id={`menu-item-${navigation.length + 1}`} className="menu-item">
                  <a href={`/wp-login.php?${logoutQuery}`}>登出</a>
                </li>
              </AdminBlock>
            </ul>
          </div>
          <div className="site-submenu">
            {config.socials.map((social) => {
              if (social.type === 'qrcode') {
                return (
                  <QRDialog
                    key={social.name}
                    url={social.link}
                    name={social.name}
                    title={social.title ?? social.name}
                    icon={social.icon}
                  />
                )
              }
              return (
                <a
                  key={social.name}
                  href={social.link}
                  target="_blank"
                  title={social.title ?? social.name}
                  className="btn btn-dark btn-icon btn-circle button-social"
                >
                  <span>
                    <Icon name={social.icon} />
                  </span>
                </a>
              )
            })}
            <SearchIcon />
          </div>
        </div>
      </header>
      <div className="mobile-brand">
        <div className="container">
          <div className="d-flex flex-flex align-items-center">
            <a href="/" title={config.title} className="d-block">
              <img src="/logo-large.svg" alt="且听书吟" />
            </a>
            <div className="flex-fill" />
            <div className="menu-toggler text-xl">
              <Icon name="menu" className="d-block" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
