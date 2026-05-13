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
  NotebookPenIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
  UserIcon,
} from 'lucide-react'
import { createContext, type ComponentType, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react'
import { Form, NavLink, Link } from 'react-router'
import { Toaster } from 'sonner'

import { AdminScrollTopButton } from '@/ui/admin/shell/AdminScrollTopButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/avatar'
import { Button } from '@/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  minRole?: 'admin' | 'author' | 'visitor'
}

const NAV: NavItem[] = [
  // All logged-in users
  { to: '/wp-admin/welcome', label: '欢迎', icon: HomeIcon, minRole: 'visitor' },
  // Author+
  { to: '/wp-admin/posts', label: '文章管理', icon: NotebookPenIcon, minRole: 'author' },
  // Admin only
  { to: '/wp-admin/pages', label: '页面管理', icon: FileTextIcon, minRole: 'admin' },
  { to: '/wp-admin/comments', label: '评论管理', icon: MessageSquareIcon, minRole: 'admin' },
  { to: '/wp-admin/categories', label: '分类管理', icon: FolderIcon, minRole: 'admin' },
  { to: '/wp-admin/tags', label: '标签管理', icon: TagsIcon, minRole: 'admin' },
  { to: '/wp-admin/friends', label: '友链管理', icon: LinkIcon, minRole: 'admin' },
  // Author+
  { to: '/wp-admin/images', label: '图片管理', icon: ImagesIcon, minRole: 'author' },
  { to: '/wp-admin/musics', label: '音乐管理', icon: Music2Icon, minRole: 'author' },
  // Admin only
  { to: '/wp-admin/users', label: '用户管理', icon: UsersIcon, matchPrefix: '/wp-admin/users', minRole: 'admin' },
  {
    to: '/wp-admin/settings/general',
    label: '系统设置',
    icon: SettingsIcon,
    matchPrefix: '/wp-admin/settings',
    minRole: 'admin',
  },
  // All logged-in users
  { to: '/wp-admin/my/comments', label: '我的评论', icon: MessageSquareIcon, minRole: 'visitor' },
]

interface AdminShellProps {
  currentUser: { id: string; name: string; email: string; role?: string | null }
  pathname: string
  children: ReactNode
}

const ROLE_ORDER: Record<string, number> = { admin: 3, author: 2, visitor: 1 }

function hasAtLeast(userRole: string | null | undefined, min: string): boolean {
  if (!userRole) {
    return false
  }
  return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[min] ?? 0)
}

function NavList({
  pathname,
  currentUser,
  onNavigate,
}: {
  pathname: string
  currentUser: AdminShellProps['currentUser']
  onNavigate?: () => void
}) {
  const visibleItems = NAV.filter((item) => !item.minRole || hasAtLeast(currentUser.role, item.minRole))
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1 px-3">
      {visibleItems.map((item) => {
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
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="size-8">
              {id ? <AvatarImage src={`/images/avatar/${id}.png`} alt={name} /> : null}
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>
          <Link to="/wp-admin/my/profile" className="flex w-full items-center gap-2">
            <UserIcon className="size-4" />
            个人信息
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/wp-admin/my/comments" className="flex w-full items-center gap-2">
            <MessageSquareIcon className="size-4" />
            我的评论
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <Form method="get" action="/wp-login.php" className="flex">
          <input type="hidden" name="action" value="logout" />
          <input type="hidden" name="redirect_to" value="/" />
          <DropdownMenuItem>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOutIcon className="size-4" />
              <span>登出</span>
            </button>
          </DropdownMenuItem>
        </Form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface AdminChromeContextValue {
  focused: boolean
  setFocused: (next: boolean) => void
  scrollTopLifted: boolean
  setScrollTopLifted: (next: boolean) => void
}

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null)

export function useAdminChrome(): AdminChromeContextValue {
  const ctx = use(AdminChromeContext)
  if (ctx === null) {
    throw new Error('useAdminChrome must be used inside <AdminShell>')
  }
  return ctx
}

export function useAdminChromeFocus(active: boolean): void {
  const { setFocused } = useAdminChrome()
  useEffect(() => {
    setFocused(active)
    return () => setFocused(false)
  }, [active, setFocused])
}

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
                <NavList pathname={pathname} currentUser={currentUser} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <a href="/wp-admin/comments" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BrandLogo className="h-7 w-auto" />
          </a>
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
            <NavList pathname={pathname} currentUser={currentUser} />
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
