import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

interface GhostSettingGroupContentProps {
  children: ReactNode
  className?: string
}

// Content wrapper for a `GhostSettingGroup`.
// Provides consistent vertical spacing between rows (e.g. `GhostSettingValue`s)
// and the canonical two-column responsive grid.
export function GhostSettingGroupContent({ children, className }: GhostSettingGroupContentProps) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>
}
