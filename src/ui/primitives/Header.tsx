import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { twMerge } from 'tailwind-merge'

import config, { type BlogConfig } from '@/blog.config'
import { DynamicIcon, MenuIcon } from '@/ui/icons/icons'
import { buttonVariants } from '@/ui/primitives/Button'
import { Container } from '@/ui/primitives/Container'
import { QRDialog } from '@/ui/primitives/QRDialog'
import { SearchIconButton } from '@/ui/search/Search'

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

  return (
    <>
      <header
        data-state={menuOpen ? 'open' : 'closed'}
        className={clsx(
          'sticky top-0 block w-[280px] h-screen z-[1020] shrink-0',
          'md:w-[240px] lg:w-[220px] xl:w-[260px] 2xl:w-[280px]',
          'max-lg:fixed max-lg:w-full max-lg:h-full max-lg:opacity-0 max-lg:invisible max-lg:pointer-events-none max-lg:transition-all max-lg:duration-500 max-lg:ease-in',
          'data-[state=open]:max-lg:opacity-100 data-[state=open]:max-lg:visible data-[state=open]:max-lg:pointer-events-auto data-[state=open]:max-lg:z-10',
        )}
      >
        <div
          className={clsx(
            'max-lg:invisible max-lg:pointer-events-none',
            'data-[state=open]:max-lg:fixed data-[state=open]:max-lg:inset-0 data-[state=open]:max-lg:bg-[rgb(8_15_25/0.3)] data-[state=open]:max-lg:visible data-[state=open]:max-lg:pointer-events-auto',
          )}
          data-state={menuOpen ? 'open' : 'closed'}
          onClick={() => setMenuOpen(false)}
        />
        <div
          data-state={menuOpen ? 'open' : 'closed'}
          className={clsx(
            'pointer-events-auto flex flex-col h-full bg-surface-inverse',
            'max-lg:fixed max-lg:w-[240px] max-lg:transition-transform max-lg:duration-[400ms] max-lg:ease-in-out max-lg:-translate-x-full',
            'data-[state=open]:max-lg:translate-x-0',
            'max-md:w-[75%]',
          )}
        >
          <h1 className="block m-0 px-[25px] pt-5 pb-[15px] shrink-0 max-lg:hidden">
            <Link to="/" title={config.title} className="block" prefetch="intent">
              <img className="max-h-[60px]" src="/logo-dark.svg" alt="且听书吟" />
            </Link>
          </h1>
          <div className="flex-auto overflow-x-hidden overflow-y-hidden" onClick={() => setMenuOpen(false)}>
            <ul className="px-3 py-[0.625rem]">
              {navigation.map((menu, i) => (
                <li id={menuId(i)} key={`menu-${i}`} className="relative block p-3">
                  {isExternalNavTarget(menu) ? (
                    <a
                      className="relative block text-white text-[0.9375rem] cursor-pointer no-underline opacity-60 hover:opacity-100"
                      href={menu.link}
                      target={menu.target}
                    >
                      {menu.text}
                    </a>
                  ) : (
                    <Link
                      className="relative block text-white text-[0.9375rem] cursor-pointer no-underline opacity-60 hover:opacity-100"
                      to={menu.link}
                      prefetch="intent"
                    >
                      {menu.text}
                    </Link>
                  )}
                </li>
              ))}
              {admin && (
                <>
                  <li id={menuId(navigation.length)} className="relative block p-3 last:[&_a]:m-0">
                    <a
                      className="relative block text-white text-[0.9375rem] cursor-pointer no-underline opacity-60 hover:opacity-100"
                      href={`/wp-login.php?${logoutQuery}`}
                    >
                      登出
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
          <div className="shrink-0 p-[25px] max-md:px-[25px] max-md:py-5">
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
                  className={twMerge(clsx(buttonVariants({ tone: 'inverse', shape: 'circle' }), 'mr-2'))}
                >
                  <span>
                    <DynamicIcon name={social.icon} />
                  </span>
                </a>
              )
            })}
            <SearchIconButton />
          </div>
        </div>
      </header>
      <div className="hidden py-4 bg-white border-b border-border-chrome max-lg:block">
        <Container>
          <div className="flex items-center">
            <Link to="/" title={config.title} className="block" prefetch="intent">
              <img className="h-[50px] max-lg:max-h-10 max-md:max-h-[35px]" src="/logo-large.svg" alt="且听书吟" />
            </Link>
            <div className="flex-1" />
            <button
              type="button"
              className="inline-flex items-center justify-center p-0 border-0 bg-transparent appearance-none text-foreground cursor-pointer leading-none text-xl"
              aria-label="打开主菜单"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon className="block" />
            </button>
          </div>
        </Container>
      </div>
    </>
  )
}
