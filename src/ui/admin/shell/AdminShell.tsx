import { LogOutIcon, MenuIcon, MessageSquareIcon, UsersIcon } from 'lucide-react'
import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { Form, NavLink } from 'react-router'

import { Avatar, AvatarFallback, AvatarImage } from '@/ui/admin/shadcn/components/ui/avatar'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Separator } from '@/ui/admin/shadcn/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/admin/shadcn/components/ui/sheet'
import { cn } from '@/ui/admin/shadcn/lib/utils'
import { AdminScrollTopButton } from '@/ui/admin/shell/AdminScrollTopButton'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { to: '/wp-admin/comments', label: '评论管理', icon: MessageSquareIcon },
  { to: '/wp-admin/users', label: '用户管理', icon: UsersIcon },
]

interface AdminShellProps {
  currentUser: { id: string; name: string; email: string }
  children: ReactNode
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="tw:flex tw:flex-col tw:gap-1 tw:px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          prefetch="intent"
          className={({ isActive }) =>
            cn(
              'tw:flex tw:items-center tw:gap-3 tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:transition-colors',
              isActive
                ? 'tw:bg-sidebar-accent tw:text-sidebar-accent-foreground'
                : 'tw:text-sidebar-foreground/80 tw:hover:bg-sidebar-accent tw:hover:text-sidebar-accent-foreground',
            )
          }
        >
          <item.icon className="tw:size-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu({ id, name, email }: { id: string; name: string; email: string }) {
  const initial = (name || email || '?').slice(0, 1).toUpperCase()
  return (
    <div className="tw:flex tw:items-center tw:gap-3">
      <Avatar className="tw:size-9">
        {id ? <AvatarImage src={`/images/avatar/${id}.png`} alt={name} /> : null}
        <AvatarFallback className="tw:bg-primary tw:text-primary-foreground tw:text-xs tw:font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="tw:hidden tw:min-w-0 tw:flex-col tw:md:flex">
        <span className="tw:text-sm tw:font-medium tw:leading-tight tw:truncate">{name}</span>
        <span className="tw:text-xs tw:text-muted-foreground tw:leading-tight tw:truncate">{email}</span>
      </div>
      <Form method="get" action="/wp-login.php" className="tw:flex">
        <input type="hidden" name="action" value="logout" />
        <input type="hidden" name="redirect_to" value="/" />
        <Button type="submit" variant="ghost" size="sm" className="tw:gap-1">
          <LogOutIcon className="tw:size-4" />
          <span className="tw:hidden tw:sm:inline">退出</span>
        </Button>
      </Form>
    </div>
  )
}

export function AdminShell({ currentUser, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Base UI portals popups (DropdownMenu, Dialog, Tooltip, …) to
  // `document.body`, which sits outside the `[data-admin-shell]` subtree
  // below. Without the attribute, the shadcn theme variables stay
  // undefined and popovers render with transparent backgrounds. Mirror
  // the marker on `<body>` while the admin shell is mounted; remove it
  // on unmount so the public site keeps its untouched palette.
  useEffect(() => {
    document.body.dataset.adminShell = ''
    return () => {
      delete document.body.dataset.adminShell
    }
  }, [])

  return (
    <div data-admin-shell className="tw:bg-background tw:text-foreground tw:min-h-screen tw:flex tw:flex-col">
      <header className="tw:bg-card tw:border-b tw:sticky tw:top-0 tw:z-30 tw:flex tw:h-14 tw:items-center tw:gap-3 tw:px-4 tw:lg:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="tw:lg:hidden" aria-label="打开菜单">
                <MenuIcon className="tw:size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="tw:w-72 tw:p-0">
            <SheetHeader>
              <SheetTitle>管理后台</SheetTitle>
            </SheetHeader>
            <Separator />
            <div className="tw:py-2">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <a
          href="/wp-admin/comments"
          className="tw:flex tw:items-center tw:gap-2 tw:text-base tw:font-semibold tw:text-foreground"
        >
          <span>且听书吟</span>
          <span className="tw:text-muted-foreground tw:hidden tw:sm:inline">·</span>
          <span className="tw:text-muted-foreground tw:hidden tw:text-sm tw:sm:inline">管理后台</span>
        </a>
        <div className="tw:flex-1" />
        <UserMenu id={currentUser.id} name={currentUser.name} email={currentUser.email} />
      </header>
      <div className="tw:flex tw:flex-1 tw:min-h-0">
        <aside className="tw:bg-sidebar tw:text-sidebar-foreground tw:hidden tw:w-60 tw:shrink-0 tw:border-r tw:lg:flex tw:flex-col tw:py-4">
          <NavList />
        </aside>
        <main className="tw:flex-1 tw:min-w-0 tw:overflow-x-hidden">
          <div className="tw:mx-auto tw:w-full tw:max-w-7xl tw:p-4 tw:lg:p-6">{children}</div>
        </main>
      </div>
      <AdminScrollTopButton />
    </div>
  )
}
