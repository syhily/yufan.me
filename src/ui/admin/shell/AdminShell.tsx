import {
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  ImagesIcon,
  LinkIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  Music2Icon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from 'lucide-react'
import { createContext, type ComponentType, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Form, NavLink, useLocation } from 'react-router'

import { AdminScrollTopButton } from '@/ui/admin/shell/AdminScrollTopButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Button } from '@/ui/components/ui/button'
import { Separator } from '@/ui/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/components/ui/sheet'
import { cn } from '@/ui/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  /**
   * Optional prefix used for the active highlight. Without it the
   * `NavLink` only matches its exact `to`; settings pages live under
   * `/wp-admin/settings/*` so the entry should stay highlighted on every
   * sub-route.
   */
  matchPrefix?: string
}

const NAV: NavItem[] = [
  { to: '/wp-admin/pages', label: '页面管理', icon: FileTextIcon },
  { to: '/wp-admin/categories', label: '分类管理', icon: FolderIcon },
  { to: '/wp-admin/tags', label: '标签管理', icon: TagsIcon },
  { to: '/wp-admin/friends', label: '友链管理', icon: LinkIcon },
  { to: '/wp-admin/images', label: '图片管理', icon: ImagesIcon },
  { to: '/wp-admin/musics', label: '音乐管理', icon: Music2Icon },
  { to: '/wp-admin/comments', label: '评论管理', icon: MessageSquareIcon },
  { to: '/wp-admin/users', label: '用户管理', icon: UsersIcon, matchPrefix: '/wp-admin/users' },
  {
    to: '/wp-admin/settings/general',
    label: '系统设置',
    icon: SettingsIcon,
    matchPrefix: '/wp-admin/settings',
  },
]

interface AdminShellProps {
  currentUser: { id: string; name: string; email: string }
  children: ReactNode
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const prefixActive = item.matchPrefix
          ? pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
          : undefined
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            prefetch="intent"
            className={({ isActive }) => {
              const active = prefixActive ?? isActive
              return cn(
                // Auto-size the leading icon through the wrapper, so the
                // icon import below stays sizing-class-free (mirrors the
                // shadcn `Button` rule of "components own icon sizing").
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function UserMenu({ id, name, email }: { id: string; name: string; email: string }) {
  const initial = (name || email || '?').slice(0, 1).toUpperCase()
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        {id ? <AvatarImage src={`/images/avatar/${id}.png`} alt={name} /> : null}
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initial}</AvatarFallback>
      </Avatar>
      <div className="hidden min-w-0 flex-col md:flex">
        <span className="truncate text-sm leading-tight font-medium">{name}</span>
        <span className="truncate text-xs leading-tight text-muted-foreground">{email}</span>
      </div>
      <Form method="get" action="/wp-login.php" className="flex">
        <input type="hidden" name="action" value="logout" />
        <input type="hidden" name="redirect_to" value="/" />
        {/* `hover:text-primary` overrides ghost variant's
            `hover:text-accent-foreground` (tailwind-merge resolves the
            conflict by source order) so hover state matches the brand
            colour the home icon uses. */}
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="gap-1 text-foreground hover:text-primary focus-visible:text-primary"
        >
          <LogOutIcon data-icon />
          <span className="hidden sm:inline">退出</span>
        </Button>
      </Form>
    </div>
  )
}

// "Focus mode" lets a child route (currently the page editor) ask the
// admin shell to collapse its left navigation rail and drop the
// content `max-width` cap, giving the editor the full viewport for
// its editor + live-preview + metadata three-pane layout. The flag
// lives in shell-scoped React state so a route opt-in is simple
// (`useAdminChromeFocus(true)` while mounted) and so the next route
// navigation automatically resets it (the unmount cleanup flips it
// back to `false`). Keeping it in context — instead of, say, a
// `data-admin-focused` attribute on `<html>` — also means the shell
// can apply Tailwind utilities directly off `focused` without
// recomputing on every paint.
interface AdminChromeContextValue {
  focused: boolean
  setFocused: (next: boolean) => void
}

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null)

export function useAdminChrome(): AdminChromeContextValue {
  const ctx = useContext(AdminChromeContext)
  if (ctx === null) {
    throw new Error('useAdminChrome must be used inside <AdminShell>')
  }
  return ctx
}

/**
 * Convenience hook used by routes that want to enter focus mode for
 * the duration of a UI state. Pass `true` to collapse the chrome,
 * `false` to restore it. The unmount cleanup always restores so
 * routes that forget to flip the flag back don't leak focus mode
 * into the next navigation.
 */
export function useAdminChromeFocus(active: boolean): void {
  const { setFocused } = useAdminChrome()
  useEffect(() => {
    setFocused(active)
    return () => setFocused(false)
  }, [active, setFocused])
}

export function AdminShell({ currentUser, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const chromeValue = useMemo<AdminChromeContextValue>(() => ({ focused, setFocused }), [focused])

  return (
    <AdminChromeContext.Provider value={chromeValue}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开菜单">
                  <MenuIcon data-icon="lg" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader>
                <SheetTitle>管理后台</SheetTitle>
              </SheetHeader>
              <Separator />
              <div className="py-2">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <a href="/wp-admin/comments" className="flex items-center gap-2 text-base font-semibold text-foreground">
            {/* `style` carries the LOGO size instead of relying on `h-7
              w-auto`. When the user arrives here through a *client-side*
              SPA navigation from the public site, React Router keeps the
              public `public.css` `<link>` attached to `<head>` for the
              current tick (see `persistentHrefs` in `react-router-dev`).
              That sheet ships an UN-LAYERED `img { height: auto }` reset —
              and per the W3C cascade-layers spec un-layered rules beat any
              layered rule of any specificity. Tailwind v4 utilities like
              `h-7` live in `@layer utilities` and silently lose, so the
              SVG renders at its intrinsic ~700px size for one paint and the
              header explodes (a hard refresh fixes it because the public
              sheet stops being fetched). Inline `style` wins both against
              un-layered selector rules and against Tailwind utilities, so
              the LOGO stays at 28px regardless of which stylesheets currently
              sit in `<head>`. The `h-7 w-auto` classes remain so the
              intent reads correctly in JSX. */}
            <img
              src="/logo-large.svg"
              alt="且听书吟"
              className="h-7 w-auto"
              style={{ height: '1.75rem', width: 'auto' }}
            />
          </a>
          {/* Quick "back to public site" affordance. Wrapped in a ghost
            Button so the hit target / focus ring / hover background match
            the logout button on the right edge of the header — the two
            controls form a visual pair (icon-button on the left, icon
            + label on the right) and previously diverged because the home
            link was a bare `<a>`. `render` swaps the underlying element
            to an anchor without losing the Button class composition.
            Full-page nav (not SPA) is intentional: admin shell and
            public chrome live in different stylesheet layers — see
            `use-detach-public-css`. */}
          <Button
            variant="ghost"
            size="icon"
            title="返回主页"
            className="text-foreground hover:text-primary focus-visible:text-primary"
            render={<a href="/" aria-label="返回主页" />}
          >
            <HomeIcon data-icon />
          </Button>
          <div className="flex-1" />
          <UserMenu id={currentUser.id} name={currentUser.name} email={currentUser.email} />
        </header>
        <div className="flex min-h-0 flex-1">
          {/* Pin the desktop nav under the sticky 56px (`h-14`) header so
            it stays visible while the main column scrolls. `sticky +
            top-14` (instead of position:fixed) keeps the layout flow
            intact, so the right-hand `<main>` still gets its natural
            width without an extra margin offset. `h-[calc(100vh-3.5rem)]`
            caps the aside to the visible area beneath the header so its
            own `overflow-y-auto` kicks in for tall menus. `z-20` keeps
            the aside under the `z-30` header but above page chrome. */}
          <aside
            className={cn(
              'sticky top-14 z-20 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col self-start overflow-y-auto border-r bg-sidebar py-4 text-sidebar-foreground lg:flex',
              // Focus mode hides the desktop nav rail. The mobile
              // `Sheet` trigger above stays available so operators on
              // small screens can still navigate, and the unmount
              // cleanup in `useAdminChromeFocus` flips this back the
              // moment they leave the editor.
              focused && 'lg:hidden',
            )}
          >
            <NavList />
          </aside>
          <main className="min-w-0 flex-1 overflow-x-hidden">
            {/* Focus mode drops the centred max-width container so
              child routes (currently the page editor) can use the
              full viewport width for their multi-pane layouts. */}
            <div className={cn(focused ? 'w-full p-2 lg:p-4' : 'mx-auto w-full max-w-7xl p-4 lg:p-6')}>{children}</div>
          </main>
        </div>
        <AdminScrollTopButton />
      </div>
    </AdminChromeContext.Provider>
  )
}
