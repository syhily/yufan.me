import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

// Icon-button content slot.
//
// The icon-only `<Button>` sizes (`iconSm | iconMd | iconLg`) all
// share the same shape: a `relative size-N` host whose icon child is
// absolutely-centred so the host's text-baseline does NOT shift the
// SVG by half a line when wrapped in flow content.
//
// Why `absolute top-0 size-full` instead of `inset-0`:
//   - `absolute inset-0` is the conceptually-cleaner equivalent
//     (top:0 + right:0 + bottom:0 + left:0 collapses to a fully-
//     stretched box). Both produce identical layouts on every
//     icon-button host this codebase ships, since each host
//     already pins `position: relative` and the icon is the only
//     positioned descendant. `top-0` + `size-full` is the
//     historical chain — preserving it keeps the rendered class
//     order identical to pre-P4 snapshots so the migration is a
//     visual no-op.
export interface IconButtonContentProps {
  children: ReactNode
  /** Extra classes appended to the centring wrapper. Rare — most callers don't need this. */
  className?: string
}

export function IconButtonContent({ children, className }: IconButtonContentProps) {
  return <span className={cn('absolute top-0 flex size-full items-center justify-center', className)}>{children}</span>
}
