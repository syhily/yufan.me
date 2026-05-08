import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

// Icon-button content slot.
//
// The icon-only `<button>` variants emitted by `publicButtonVariants`
// (`size: iconSm | iconMd | iconLg`) all share the same shape: a
// `relative size-N` host whose icon child is absolutely-centred so
// the host's text-baseline does NOT shift the SVG by half a line
// when wrapped in flow content. Five callers were repeating the
// exact same `<span className="absolute top-0 flex size-full
// items-center justify-center">…</span>` wrapper:
//
//   1. `QRDialog` social-trigger button
//   2. `LikeActions.QQShare` icon button
//   3. `LikeActions.WeiboShare` icon button
//   4. `ScrollTopButton` (back-to-top)
//   5. `Header` social-rail trigger
//   6. `Search.SearchIconButton` (sidebar trigger)
//
// Centralising the wrapper means every icon button gets the same
// centring rule for free, and the cn() chain above documents
// *why* the centring is absolute (text-baseline drift) instead of
// flexed (which would require resetting `line-height` on the host).
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
