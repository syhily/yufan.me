import type { ReactNode } from 'react'

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { createContext, useContext } from 'react'

import { cn } from '@/ui/lib/cn'

const TOOLTIP_POPUP_CLASS = cn(
  'z-(--z-toast)',
  'max-w-[min(24rem,calc(100vw-1rem))]',
  'px-2.5 py-1.5',
  'rounded-xs bg-surface text-foreground',
  'shadow-[0_8px_28px_rgb(40_49_73/0.14)]',
  'text-[0.8125rem] leading-[1.6]',
  'pointer-events-none',
  'transition-[opacity,transform] duration-150 ease-out',
  'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
)

export type TooltipPlacement = 'top' | 'left'

export interface TooltipRootProps {
  children: ReactNode
  placement?: TooltipPlacement
}

const PlacementContext = createContext<TooltipPlacement>('top')

// Public root keeps the previous `<Tooltip placement="top">` shape so callers
// in `@/ui/sidebar/Sidebar` and `@/ui/mdx/Footnotes` do not change. Internally
// we delegate everything to Base UI's `Tooltip.Provider/Root` pair, which
// handles ARIA, focus, hover/keyboard intent, and Floating-UI placement.
export function TooltipRoot({ children, placement = 'top' }: TooltipRootProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <PlacementContext.Provider value={placement}>{children}</PlacementContext.Provider>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Element type to render. Defaults to `<span>` since tooltips usually
   * wrap inline content. Mapped onto Base UI's `render` prop so the
   * trigger keeps its host tag, attributes, and event handlers.
   */
  as?: keyof React.JSX.IntrinsicElements
  children: ReactNode
}

export function TooltipTrigger({ as = 'span', children, ...rest }: TooltipTriggerProps) {
  const Element = as as React.ElementType
  return <BaseTooltip.Trigger render={<Element {...rest}>{children}</Element>} />
}

export interface TooltipContentProps {
  children: ReactNode
}

export function TooltipContent({ children }: TooltipContentProps) {
  const placement = useContext(PlacementContext)
  const hasContent = children !== null && children !== undefined && children !== false && children !== ''
  if (!hasContent) {
    return null
  }

  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={placement} sideOffset={8}>
        <BaseTooltip.Popup className={TOOLTIP_POPUP_CLASS}>
          {children}
          <BaseTooltip.Arrow
            className={cn(
              'text-surface',
              placement === 'left' ? 'data-[side=left]:-mr-1.5' : 'data-[side=top]:-mb-1.5',
            )}
          >
            {placement === 'left' ? (
              <svg aria-hidden="true" focusable="false" viewBox="0 0 6 12" width="6" height="12">
                <path d="M0 0 L6 6 L0 12 Z" fill="currentColor" />
              </svg>
            ) : (
              <svg aria-hidden="true" focusable="false" viewBox="0 0 12 6" width="12" height="6">
                <path d="M0 0 L6 6 L12 0 Z" fill="currentColor" />
              </svg>
            )}
          </BaseTooltip.Arrow>
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

// Compound-component namespace preserved so existing `<Tooltip>` /
// `<Tooltip.Trigger>` / `<Tooltip.Content>` call sites in `@/ui/mdx/Footnotes`
// and `@/ui/sidebar/Sidebar` keep working without edits.
export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
})
