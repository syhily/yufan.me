import {
  ArchiveRestoreIcon,
  ChartLineIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  ImagesIcon,
  LinkIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  MonitorIcon,
  Music2Icon,
  NotebookPenIcon,
  SettingsIcon,
  SmartphoneIcon,
  TagsIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { createContext, type ComponentType, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { Toaster } from 'sonner'

import { hasAtLeast } from '@/shared/utils/roles'
import { AdminScrollTopButton } from '@/ui/admin/shell/AdminScrollTopButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/avatar'
import { Button } from '@/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu'
import { Separator } from '@/ui/components/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/components/sheet'
import { cn } from '@/ui/lib/cn'
import { BrandLogo } from '@/ui/public/chrome/BrandLogo'
import { ThemeToggle } from '@/ui/public/chrome/ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  matchPrefix?: string
  end?: boolean
  minRole: 'visitor' | 'author' | 'admin'
}

const NAV: NavItem[] = [
  { to: '/admin', label: '欢迎页面', icon: HomeIcon, end: true, minRole: 'visitor' },
  { to: '/admin/posts', label: '文章管理', icon: NotebookPenIcon, minRole: 'author' },
  { to: '/admin/pages', label: '页面管理', icon: FileTextIcon, minRole: 'admin' },
  { to: '/admin/restore', label: '回收站', icon: ArchiveRestoreIcon, minRole: 'admin' },
  { to: '/admin/comments', label: '评论管理', icon: MessageSquareIcon, minRole: 'admin' },
  { to: '/admin/categories', label: '分类管理', icon: FolderIcon, minRole: 'admin' },
  { to: '/admin/tags', label: '标签管理', icon: TagsIcon, minRole: 'author' },
  { to: '/admin/friends', label: '友链管理', icon: LinkIcon, minRole: 'admin' },
  { to: '/admin/library/images', label: '图片管理', icon: ImagesIcon, minRole: 'author' },
  { to: '/admin/library/music', label: '音乐管理', icon: Music2Icon, minRole: 'author' },
  { to: '/admin/users', label: '用户管理', icon: UsersIcon, matchPrefix: '/admin/users', minRole: 'admin' },
  { to: '/admin/security/sessions', label: '会话管理', icon: SmartphoneIcon, minRole: 'admin' },
  {
    to: '/admin/analytics',
    label: '访问统计',
    icon: ChartLineIcon,
    matchPrefix: '/admin/analytics',
    minRole: 'admin',
  },
  {
    to: '/admin/settings/general',
    label: '系统设置',
    icon: SettingsIcon,
    matchPrefix: '/admin/settings',
    minRole: 'admin',
  },
]

interface AdminShellProps {
  currentUser: { id: string; name: string; email: string; role: 'admin' | 'author' | 'visitor' | null }
  pathname: string
  children: ReactNode
}

function NavList({
  pathname,
  onNavigate,
  role,
}: {
  pathname: string
  onNavigate?: () => void
  role: AdminShellProps['currentUser']['role']
}) {
  // Reuse the same `hasAtLeast` ladder the server-side guards use,
  // so future role additions (e.g. `editor`) propagate to the
  // sidebar automatically.
  const visibleNav = NAV.filter((item) => hasAtLeast(role, item.minRole))
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1 px-3">
      {visibleNav.map((item) => {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="用户菜单">
            <Avatar className="size-9">
              {id ? <AvatarImage src={`/images/avatar/${id}.png`} alt={name} /> : null}
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link to="/admin/me/profile" prefetch="intent">
              <UserIcon /> 个人信息
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link to="/admin/me/comments" prefetch="intent">
              <MessageSquareIcon /> 我的评论
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link to="/admin/me/sessions" prefetch="intent">
              <MonitorIcon /> 登录设备
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <a href="/admin/signin?action=logout&redirect_to=/">
              <LogOutIcon /> 登出
            </a>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
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
  // Set by editor routes for the duration of their mount when a
  // bottom-right FAB (today: `FloatingPublishButton`) may surface in
  // the same corner ScrollTop normally occupies. AdminShell ORs this
  // with `focused` to decide whether the ScrollTop FAB needs to ride
  // higher (`bottom-20 lg:bottom-24`) instead of its default
  // `bottom-4 lg:bottom-6` slot. Independent from `focused` because
  // ScrollTop must clear the publish FAB even in plain editing
  // (no live preview); previously the two FABs overlapped and the
  // ScrollTop FAB swallowed every click that should have reached
  // publish.
  scrollTopLifted: boolean
  setScrollTopLifted: (next: boolean) => void
}

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null)

const NOOP_CHROME: AdminChromeContextValue = {
  focused: false,
  setFocused: () => {},
  scrollTopLifted: false,
  setScrollTopLifted: () => {},
}

export function useAdminChrome(): AdminChromeContextValue {
  const ctx = use(AdminChromeContext)
  return ctx ?? NOOP_CHROME
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

/**
 * Signals to the admin shell that the current route mounts a
 * bottom-right FAB (e.g. the editor's publish button), so the shared
 * `AdminScrollTopButton` should ride above its default slot to keep
 * both FABs reachable. Pairs with `useAdminChromeFocus` but is
 * orthogonal: focus mode collapses the left rail and switches the
 * scroll root to `<main>`, while this only lifts the ScrollTop FAB.
 * Plain editing (no live preview) needs the lift; preview mode also
 * gets it via the OR in `AdminShell`.
 */
export function useAdminScrollTopLift(active: boolean): void {
  const { setScrollTopLifted } = useAdminChrome()
  useEffect(() => {
    setScrollTopLifted(active)
    return () => setScrollTopLifted(false)
  }, [active, setScrollTopLifted])
}

export function AdminShell({ currentUser, pathname, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [scrollTopLifted, setScrollTopLifted] = useState(false)
  const mainScrollRef = useRef<HTMLElement | null>(null)
  const chromeValue = useMemo<AdminChromeContextValue>(
    () => ({ focused, setFocused, scrollTopLifted, setScrollTopLifted }),
    [focused, scrollTopLifted],
  )

  return (
    <AdminChromeContext.Provider value={chromeValue}>
      <div
        className={cn(
          'flex flex-col bg-background text-foreground',
          // Viewport lock + `<main>` scroll only while the page editor is in
          // focus mode (live preview). Other admin routes keep the relaxed
          // `min-h-screen` document flow so list pages and the non-preview
          // editor do not look cramped.
          focused ? 'h-dvh max-h-dvh min-h-0 overflow-hidden' : 'min-h-screen',
        )}
      >
        <header
          className={cn(
            'z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-6',
            !focused && 'sticky top-0',
          )}
        >
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
                <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} role={currentUser.role} />
              </div>
            </SheetContent>
          </Sheet>
          <a href="/admin" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BrandLogo className="h-7 w-auto" />
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
          <ThemeToggle mode="admin" />
          <div className="flex-1" />
          <UserMenu id={currentUser.id} name={currentUser.name} email={currentUser.email} />
        </header>
        <div className={cn('flex min-h-0 flex-1', focused && 'overflow-hidden')}>
          <aside
            className={cn(
              'z-20 hidden w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar py-4 text-sidebar-foreground lg:flex',
              focused ? 'min-h-0' : 'sticky top-14 h-[calc(100vh-3.5rem)] self-start',
              focused && 'lg:hidden',
            )}
          >
            <NavList pathname={pathname} role={currentUser.role} />
          </aside>
          <main
            ref={mainScrollRef}
            className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden', focused && 'overflow-y-auto')}
          >
            <div
              className={cn(
                focused && 'flex min-h-0 flex-1 flex-col',
                focused ? 'w-full p-2 lg:p-4' : 'mx-auto w-full max-w-7xl p-4 lg:p-6',
              )}
            >
              {children}
            </div>
          </main>
        </div>
        <AdminScrollTopButton
          lifted={focused || scrollTopLifted}
          {...(focused ? { scrollRootRef: mainScrollRef } : {})}
        />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </AdminChromeContext.Provider>
  )
}
