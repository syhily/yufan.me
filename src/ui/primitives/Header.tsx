import { Drawer } from '@base-ui/react/drawer'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import type { BlogConfig } from '@/blog.config'

import { DynamicIcon, MenuIcon, iconByName } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'
import { buttonVariants } from '@/ui/primitives/Button'
import { Container } from '@/ui/primitives/Container'
import { QRDialog } from '@/ui/primitives/QRDialog'
import { useSiteConfig } from '@/ui/primitives/site-config'
import { toneAttrs } from '@/ui/primitives/tone'
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
  if (menu.target === '_blank') {
    return true
  }
  return /^https?:\/\//.test(menu.link)
}

const NAV_LINK_CLASS =
  'relative block text-white text-[0.9375rem] cursor-pointer no-underline opacity-60 hover:opacity-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:rounded-xs focus-visible:opacity-100'

interface HeaderNavProps {
  navigation: BlogConfig['navigation']
  admin: boolean
  logoutQuery: string
  /**
   * Fired whenever a nav link is activated. The mobile drawer uses this to
   * dismiss itself on selection; on desktop the callback is a no-op so the
   * link click goes straight to React Router. Sites that surface the same
   * `<HeaderNav>` from a non-drawer context (e.g. embedded admin previews)
   * can still pass an empty function.
   */
  onSelect: () => void
}

// `<HeaderNav>` is rendered twice: once inside the always-visible desktop
// `<aside>` (`hidden lg:flex`) and once inside the mobile `Drawer.Popup`.
// The DOM duplication is intentional — Base UI's Drawer mounts into a portal
// at the body, so the node graph cannot be shared with the in-flow desktop
// aside. The list itself is six links + a few socials, so the byte cost is
// trivial and keeps each surface free to evolve its own chrome.
function HeaderNav({ navigation, admin, logoutQuery, onSelect }: HeaderNavProps) {
  const { title, socials } = useSiteConfig()
  return (
    <>
      <h1 className="m-0 px-[25px] pt-5 pb-[15px] shrink-0">
        <Link to="/" title={title} className="block" prefetch="intent" onClick={onSelect}>
          <img className="max-h-[60px]" src="/logo-dark.svg" alt={title} />
        </Link>
      </h1>
      <nav className="flex-auto overflow-x-hidden overflow-y-hidden" aria-label="主菜单">
        <ul className="px-3 py-[0.625rem]">
          {navigation.map((menu, i) =>
            isExternalNavTarget(menu) ? (
              <li id={menuId(i)} key={`menu-${i}`} className="relative block p-3">
                <a className={NAV_LINK_CLASS} href={menu.link} target={menu.target} onClick={onSelect}>
                  {menu.text}
                </a>
              </li>
            ) : (
              <li id={menuId(i)} key={`menu-${i}`} className="relative block p-3">
                <Link className={NAV_LINK_CLASS} to={menu.link} prefetch="intent" onClick={onSelect}>
                  {menu.text}
                </Link>
              </li>
            ),
          )}
          {admin && (
            <li id={menuId(navigation.length)} className="relative block p-3 last:[&_a]:m-0">
              <a className={NAV_LINK_CLASS} href={`/wp-login.php?${logoutQuery}`} onClick={onSelect}>
                登出
              </a>
            </li>
          )}
        </ul>
      </nav>
      <div className="shrink-0 px-[25px] py-5 md:p-[25px]">
        {socials.map((social) => {
          if (social.type === 'qrcode') {
            return (
              <QRDialog
                key={social.name}
                url={social.link}
                name={social.name}
                title={social.title ?? social.name}
                icon={iconByName[social.icon]}
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
              className={cn(buttonVariants({ tone: 'inverse', shape: 'circle' }), 'mr-2')}
              {...toneAttrs('inverse', 'solid')}
            >
              <span>
                <DynamicIcon name={social.icon} />
              </span>
            </a>
          )
        })}
        <SearchIconButton />
      </div>
    </>
  )
}

export function Header({ navigation, admin }: HeaderProps) {
  const { title } = useSiteConfig()
  const { pathname, search } = useLocation()
  const logoutQuery = new URLSearchParams({
    action: 'logout',
    redirect_to: `${pathname}${search}`,
  }).toString()

  // Mobile drawer open/close state. Base UI's `Drawer.Root` owns the focus
  // trap, scroll lock, Escape handler, swipe-to-dismiss gesture, and ARIA
  // wiring; we only retain the controlled `open` so we can close the drawer
  // when navigation moves the URL away (and so the in-tree `<HeaderNav>`'s
  // link `onClick` handler can dismiss the popup synchronously).
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const closeMenu = () => setMenuOpen(false)

  return (
    <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen} swipeDirection="left">
      {/*
        Desktop site banner: `<header>` (mapped to the `banner` landmark by
        screen readers when scoped to <body>) carries the site title and
        the primary `<nav>`. The drawer trigger lives below in the mobile
        top bar; on desktop the sidebar is permanently visible so no
        Drawer state is consulted here.
      */}
      <header
        className={cn(
          'hidden lg:sticky lg:top-0 lg:flex lg:flex-col lg:shrink-0',
          'lg:h-screen lg:w-[220px] xl:w-[260px] 2xl:w-[280px]',
          'bg-surface-inverse',
        )}
      >
        <HeaderNav navigation={navigation} admin={admin} logoutQuery={logoutQuery} onSelect={NOOP} />
      </header>
      <div className="block py-4 bg-white border-b border-border-chrome lg:hidden">
        <Container>
          <div className="flex items-center">
            <Link to="/" title={title} className="block" prefetch="intent">
              <img className="max-h-[35px] sm:max-h-10 lg:h-[50px]" src="/logo-large.svg" alt={title} />
            </Link>
            <div className="flex-1" />
            <Drawer.Trigger
              className={cn(
                'inline-flex items-center justify-center p-0 border-0 bg-transparent appearance-none',
                'text-foreground cursor-pointer leading-none text-xl',
                'rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
              aria-label="打开主菜单"
            >
              <MenuIcon className="block" />
            </Drawer.Trigger>
          </div>
        </Container>
      </div>
      <Drawer.Portal>
        <Drawer.Backdrop
          className={cn(
            'fixed inset-0 z-(--z-drawer) bg-overlay-scrim',
            'opacity-[calc(0.3*(1-var(--drawer-swipe-progress,0)))]',
            'transition-opacity duration-[400ms] ease-out',
            'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[swiping]:transition-none',
            'lg:hidden',
          )}
        />
        <Drawer.Viewport className={cn('fixed inset-0 z-(--z-drawer) flex items-stretch justify-start', 'lg:hidden')}>
          <Drawer.Popup
            className={cn(
              'pointer-events-auto flex flex-col bg-surface-inverse',
              'h-full w-[75%] max-w-[320px] md:w-[240px]',
              '[transform:translateX(var(--drawer-swipe-movement-x,0))]',
              'transition-transform duration-[400ms] ease-out',
              'data-[ending-style]:[transform:translateX(-100%)]',
              'data-[starting-style]:[transform:translateX(-100%)]',
              'data-[swiping]:transition-none data-[swiping]:select-none',
            )}
          >
            <Drawer.Title className="sr-only">主菜单</Drawer.Title>
            <HeaderNav navigation={navigation} admin={admin} logoutQuery={logoutQuery} onSelect={closeMenu} />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function NOOP() {}
