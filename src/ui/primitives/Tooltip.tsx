import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const GAP = 8

const TOOLTIP_CLASS = [
  'absolute z-[1080]',
  'max-w-[min(24rem,calc(100vw-1rem))]',
  'px-2.5 py-1.5',
  'rounded-xs text-foreground bg-surface',
  'shadow-[0_8px_28px_rgb(40_49_73/0.14)]',
  'text-[0.8125rem] leading-[1.6]',
  'pointer-events-none',
].join(' ')

export type TooltipPlacement = 'top' | 'left'

interface TooltipPosition {
  left: number
  top: number
}

// `vercel-composition-patterns/architecture-avoid-boolean-props`: replace the
// previous `cloneElement(child, { onMouseEnter, onFocus, ... })` adapter with
// a small Context. Each subcomponent reads only what it needs from this value
// — `<TooltipTrigger>` wires the ref + listeners, `<TooltipContent>` renders
// the portal — so consumers can compose any DOM element they want without
// the root needing to know about it.
interface TooltipContextValue {
  id: string
  visible: boolean
  hasContent: boolean
  placement: TooltipPlacement
  position: TooltipPosition | null
  triggerRef: React.RefObject<HTMLElement | null>
  tooltipRef: React.RefObject<HTMLDivElement | null>
  show: () => void
  hide: () => void
  setPosition: (position: TooltipPosition | null) => void
  /** Identifies whether the content carries any renderable value. */
  setHasContent: (hasContent: boolean) => void
}

const TooltipContext = createContext<TooltipContextValue | null>(null)

function useTooltipContext(component: string): TooltipContextValue {
  const ctx = useContext(TooltipContext)
  if (ctx === null) {
    throw new Error(`<${component}> must be rendered inside <Tooltip>`)
  }
  return ctx
}

export interface TooltipRootProps {
  children: ReactNode
  placement?: TooltipPlacement
}

export function TooltipRoot({ children, placement = 'top' }: TooltipRootProps) {
  const id = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [hasContent, setHasContent] = useState(false)

  const show = useCallback(() => {
    setPosition(null)
    setVisible(true)
  }, [])
  const hide = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (!visible) return

    const update = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return
      setPosition(place(trigger, tooltip, placement))
    }
    const hideOnScroll = () => setVisible(false)

    update()
    window.addEventListener('resize', hideOnScroll)
    window.addEventListener('scroll', hideOnScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', hideOnScroll)
      window.removeEventListener('scroll', hideOnScroll)
    }
  }, [placement, visible])

  const value = useMemo<TooltipContextValue>(
    () => ({
      id,
      visible,
      hasContent,
      placement,
      position,
      triggerRef,
      tooltipRef,
      show,
      hide,
      setPosition,
      setHasContent,
    }),
    [id, visible, hasContent, placement, position, show, hide],
  )

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  /** Element type to render. Defaults to `<span>` since tooltips usually wrap inline content. */
  as?: keyof React.JSX.IntrinsicElements
  children: ReactNode
}

// `<TooltipTrigger>` owns the host element. Composing this way keeps the
// interactive element's tag, attributes, and refs visible at the call site —
// no more `cloneElement` rewriting unknown props onto an opaque child.
export function TooltipTrigger({
  as = 'span',
  children,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: TooltipTriggerProps) {
  const ctx = useTooltipContext('TooltipTrigger')
  const Comp = as as React.ElementType

  const handleMouseEnter: React.MouseEventHandler<HTMLElement> = (event) => {
    onMouseEnter?.(event)
    if (!event.isDefaultPrevented() && ctx.hasContent) ctx.show()
  }
  const handleMouseLeave: React.MouseEventHandler<HTMLElement> = (event) => {
    onMouseLeave?.(event)
    if (!event.isDefaultPrevented()) ctx.hide()
  }
  const handleFocus: React.FocusEventHandler<HTMLElement> = (event) => {
    onFocus?.(event)
    if (!event.isDefaultPrevented() && ctx.hasContent) ctx.show()
  }
  const handleBlur: React.FocusEventHandler<HTMLElement> = (event) => {
    onBlur?.(event)
    if (!event.isDefaultPrevented()) ctx.hide()
  }

  return (
    <Comp
      {...rest}
      ref={ctx.triggerRef as React.Ref<HTMLElement>}
      aria-describedby={ctx.visible && ctx.hasContent ? ctx.id : rest['aria-describedby']}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
    </Comp>
  )
}

export interface TooltipContentProps {
  children: ReactNode
}

export function TooltipContent({ children }: TooltipContentProps) {
  const ctx = useTooltipContext('TooltipContent')
  const hasContent = children !== null && children !== undefined && children !== false && children !== ''

  // Surface "do we have content?" to the trigger via context. The trigger
  // skips `show()` when there's nothing to render, mirroring the legacy
  // `hasContent` short-circuit without leaking the check across components.
  useEffect(() => {
    ctx.setHasContent(hasContent)
  }, [ctx, hasContent])

  if (!ctx.visible || !hasContent || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ctx.tooltipRef}
      id={ctx.id}
      className={TOOLTIP_CLASS}
      role="tooltip"
      style={{
        left: ctx.position?.left ?? 0,
        top: ctx.position?.top ?? 0,
        visibility: ctx.position === null ? 'hidden' : undefined,
      }}
    >
      {children}
      <TooltipArrow placement={ctx.placement} />
    </div>,
    document.body,
  )
}

// SVG arrow that replaces the previous `::before` triangle. The fill picks
// up the tooltip's background-color via `fill="currentColor"` plus a
// `text-surface` colour utility, and `aria-hidden` keeps it out of the
// accessibility tree (the `<div role="tooltip">` parent is what assistive
// tech reads).
function TooltipArrow({ placement }: { placement: TooltipPlacement }) {
  if (placement === 'left') {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 6 12"
        width="6"
        height="12"
        className="absolute top-1/2 -right-[6px] -mt-[6px] text-surface"
      >
        <path d="M0 0 L6 6 L0 12 Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 6"
      width="12"
      height="6"
      className="absolute left-1/2 -bottom-[6px] -ml-[6px] text-surface"
    >
      <path d="M0 0 L6 6 L12 0 Z" fill="currentColor" />
    </svg>
  )
}

// Compound-component namespace. Call sites compose `<Tooltip>` (the root,
// renamed `TooltipRoot` internally so consumers can spell it `Tooltip.Root`)
// with `Tooltip.Trigger` and `Tooltip.Content`.
//
// Removing the legacy single-prop adapter intentionally: the previous
// `cloneElement`-based shim couldn't pick the right host element for non-span
// triggers (e.g. `<div className="widget-title">`), so every call site now
// passes its own host element directly through `<Tooltip.Trigger as=...>`.
export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
})

function place(target: HTMLElement, tooltip: HTMLElement, placement: TooltipPlacement): TooltipPosition {
  const rect = target.getBoundingClientRect()
  const tip = tooltip.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  let top: number
  let left: number
  if (placement === 'left') {
    top = scrollY + rect.top + rect.height / 2 - tip.height / 2
    left = scrollX + rect.left - tip.width - GAP
  } else {
    top = scrollY + rect.top - tip.height - GAP
    left = scrollX + rect.left + rect.width / 2 - tip.width / 2
  }

  left = Math.max(scrollX + GAP, Math.min(left, scrollX + window.innerWidth - tip.width - GAP))
  top = Math.max(scrollY + GAP, top)
  return { left, top }
}
