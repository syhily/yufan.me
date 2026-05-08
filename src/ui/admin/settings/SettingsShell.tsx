import { ChevronDownIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { NavLink } from 'react-router'

import { SECTION_DISPLAY_LIST } from '@/shared/config/settings'
import { Button } from '@/ui/components/button'
import { Separator } from '@/ui/components/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/components/sheet'
import { cn } from '@/ui/lib/cn'

// Sidebar section list. The data lives in `@/shared/config/settings` so
// adding the 13th settings page is a one-file change there (extend
// `SETTINGS_SECTIONS` + add a `SECTION_DISPLAY` entry); this
// component picks it up automatically without a sibling edit.
const SECTIONS = SECTION_DISPLAY_LIST

interface SettingsShellProps {
  pathname: string
  children: ReactNode
}

// Single shared section list — rendered once for the mobile Sheet
// drawer and once for the desktop sidebar. Pulling the JSX into a
// reusable component (instead of two copy-pasted blocks like before)
// guarantees the two presentations can never drift on a future
// schema change.
function SectionNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-1">
      {SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          prefetch="intent"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )
          }
        >
          <span className="font-medium">{section.label}</span>
          <span className="text-xs text-muted-foreground">{section.description}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function SettingsShell({ pathname, children }: SettingsShellProps) {
  const activeSection =
    SECTIONS.find((section) => pathname === section.to || pathname.startsWith(`${section.to}/`)) ?? SECTIONS[0]

  // Mobile drawer open state. Each `NavLink` triggers `onNavigate`
  // which closes the sheet, mirroring the AdminShell mobile menu.
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground">这里管理博客的运行期配置，修改后立即生效，无需重新部署。</p>
      </header>
      {/*
       * Mobile (< lg): 1 column. The section nav lives behind a
       * `<Sheet>` trigger that shows the currently-active section's
       * label as a button — same pattern as the AdminShell mobile
       * drawer (consistent affordance across the admin surface).
       * Desktop (≥ lg): 2 columns; the COLUMN gap between sub-nav
       * and content cards is intentionally tightened from 24px to
       * 16px so the editor's visual scan path between picking a
       * section on the left and seeing its cards on the right
       * doesn't cross a wide chasm.
       */}
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-4 lg:gap-y-0">
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between py-3 text-left text-sm font-normal"
                  aria-label="切换设置分区"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs tracking-wide text-muted-foreground uppercase">当前页签</span>
                    <span className="truncate font-medium">{activeSection.label}</span>
                  </div>
                  <ChevronDownIcon data-icon className="shrink-0" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader>
                <SheetTitle>系统设置</SheetTitle>
              </SheetHeader>
              <Separator />
              <div className="overflow-y-auto p-2">
                <SectionNav onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <aside className="hidden lg:block">
          <SectionNav />
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  )
}
