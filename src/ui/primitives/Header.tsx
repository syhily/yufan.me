import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import config, { type BlogConfig } from '@/blog.config'
import { Icon } from '@/ui/icons/Icon'
import { QRDialog } from '@/ui/primitives/QRDialog'
import { SearchIcon } from '@/ui/search/Search'

export interface HeaderProps {
  navigation: BlogConfig['navigation']
  admin: boolean
}

// Sequential WordPress-theme-style menu item IDs. No CSS or JS in this repo
// targets these IDs by number, but downstream WP-compatible themes/integrations
// often do, so we keep the numbering deterministic and intentional via this
// helper rather than open-coding `menu-item-${i}` in three places.
function menuId(index: number): string {
  return `menu-item-${index}`
}

// Internal navigation links that target the same site live in `<Link>` so
// React Router can perform client-side transitions and `prefetch` the next
// route's data. External / `target="_blank"` links stay as plain `<a>` since
// they leave the SPA boundary anyway.
function isExternalNavTarget(menu: BlogConfig['navigation'][number]): boolean {
  if (menu.target === '_blank') return true
  return /^https?:\/\//.test(menu.link)
}

export function Header({ navigation, admin }: HeaderProps) {
  const { pathname, search } = useLocation()
  const logoutQuery = new URLSearchParams({
    action: 'logout',
    redirect_to: `${pathname}${search}`,
  }).toString()

  // Mobile aside menu open/close state. Previously driven by `.site-aside.in`
  // toggles in `features/menu-toggle.ts`; keeping the state inside React means
  // the menu closes automatically on route change (we clear the flag whenever
  // the pathname moves).
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const asideClass = menuOpen ? 'site-aside in' : 'site-aside'

  return (
    <>
      <header className={asideClass}>
        <div className="aside-overlay" onClick={() => setMenuOpen(false)} />
        <div className="aside-inner bg-secondary">
          <h1 className="navbar-brand">
            <Link to="/" title={config.title} className="d-block" prefetch="intent">
              <img src="/logo-dark.svg" alt="且听书吟" />
            </Link>
          </h1>
          <div className="site-menu" onClick={() => setMenuOpen(false)}>
            <ul>
              {navigation.map((menu, i) => (
                <li id={menuId(i)} key={`menu-${i}`} className={`menu-item${i === 0 ? ' menu-item-home' : ''}`}>
                  {isExternalNavTarget(menu) ? (
                    <a href={menu.link} target={menu.target}>
                      {menu.text}
                    </a>
                  ) : (
                    <Link to={menu.link} prefetch="intent">
                      {menu.text}
                    </Link>
                  )}
                </li>
              ))}
              {admin && (
                <>
                  <li id={menuId(navigation.length)} className="menu-item">
                    <Link to="/wp-admin/" prefetch="intent">
                      评论
                    </Link>
                  </li>
                  <li id={menuId(navigation.length + 1)} className="menu-item">
                    <a href={`/wp-login.php?${logoutQuery}`}>登出</a>
                  </li>
                </>
              )}
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
                  rel="noreferrer"
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
            <Link to="/" title={config.title} className="d-block" prefetch="intent">
              <img src="/logo-large.svg" alt="且听书吟" />
            </Link>
            <div className="flex-fill" />
            <button
              type="button"
              className="menu-toggler text-xl"
              aria-label="打开主菜单"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" className="d-block" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
