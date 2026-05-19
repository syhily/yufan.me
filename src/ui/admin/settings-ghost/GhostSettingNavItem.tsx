import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

interface GhostSettingNavItemProps {
  /** Navigation item label rendered as the primary text. */
  label: string
  /** Optional one-line description shown beneath the label. */
  description?: string
  /** Whether this item represents the currently-visible section. */
  isActive?: boolean
  /** Click handler — wired to scroll-to-section or route navigation. */
  onClick: () => void
  /** Optional icon rendered before the label. */
  icon?: ReactNode
}

// A single item in the Ghost-style settings sidebar.
// Mimics AdminX's compact nav: muted by default, bold + accent border
// when active, subtle background tint on hover.
export function GhostSettingNavItem({ label, description, isActive, onClick, icon }: GhostSettingNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
        'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden',
        isActive
          ? 'border-l-2 border-brand bg-accent/60 font-medium text-foreground'
          : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </span>
      {description ? <span className="truncate text-xs opacity-70">{description}</span> : null}
    </button>
  )
}
