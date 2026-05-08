import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { type ReactNode, createContext, use } from 'react'

import { cn } from '@/ui/lib/cn'

// Public-tree tooltip built on `@base-ui/react/tooltip`. Previously
// this file reimplemented positioning, portal rendering, focus/hover
// wiring, scroll-hide and context-based composition by hand (~237
// lines). Base UI ships all of that out-of-the-box with the `Root /
// Trigger / Positioner / Portal / Popup` composition, so the public
// primitive is now a thin adapter that lets the library manage
// open/close/focus/layout while the visual chrome (white pill +
// drop shadow + ::before arrow) is expressed as Tailwind utilities
// directly on `<TooltipContent>` below.

export type TooltipPlacement = 'top' | 'left'

// Visual chrome shared by every placement. Mirrors the legacy
// `.site-tooltip` rule set:
//
//   - `relative` keeps the `::before` arrow anchored to the bubble's
//     edge inside Base UI's `<Positioner>` coordinate system. Do not
//     promote this to `absolute`; the Positioner already owns
//     positioning and an absolute popup escapes its frame (the bug
//     that previously surfaced as "tall / misplaced bubble").
//   - `z-[1080]` sits above the legacy WordPress chrome.
//   - `w-max` plus the clamped `max-w-…` keep short labels like
//     "云中谁寄锦书来？" laid out horizontally instead of collapsing
//     into a vertical character column when the Positioner's width is
//     narrow.
//   - `text-[0.8125rem]` and `leading-[1.6]` capture the legacy
//     13px / 1.6 typography (Tailwind's `text-sm` is 14px, so the
//     arbitrary value is intentional).
//   - `rounded-xs`, `text-ink-strong`, `shadow-tooltip` map
//     to the same `--radius-xs`, `--color-dark`, and navy-tinted
//     `--shadow-tooltip` tokens declared in `_tokens.css` /
//     `tailwind.css`.
const TOOLTIP_BASE_CLASS =
  'pointer-events-none relative z-[1080] w-max max-w-[min(24rem,calc(100vw-1rem))] rounded-xs bg-white px-2.5 py-1.5 text-[0.8125rem] leading-[1.6] text-ink-strong shadow-tooltip'

// Arrow geometry, driven by Base UI's `data-side` attribute on the
// popup. Base UI exposes the *resolved* side after collision avoidance
// runs — by default it ships `collisionAvoidance.side: 'flip'`, so a
// `placement="top"` bubble that no longer fits above the trigger
// (e.g. a footnote near the bottom of the viewport) automatically
// flips to `bottom` and `data-side` becomes `"bottom"`. Selecting the
// arrow chain off `data-side` instead of off the *requested*
// `placement` therefore guarantees the triangle always anchors to
// the bubble edge facing the trigger and points back at it; the
// previous static lookup left the arrow on the wrong edge after a
// flip (the bug that surfaced as "tooltip clipped at viewport bottom
// renders with a downward arrow at the bottom").
//
// Each chain mirrors the retired `.site-tooltip-<side>::before` rule
// set:
//
//   * `top`    — bubble above trigger, arrow points down from the
//     bubble's bottom edge → white top edge, transparent sides, zero
//     bottom edge.
//   * `bottom` — bubble below trigger, arrow points up from the
//     bubble's top edge → white bottom edge, transparent sides, zero
//     top edge.
//   * `left`   — bubble left of trigger, arrow points right from the
//     bubble's right edge → white left edge, transparent top/bottom,
//     zero right edge.
//   * `right`  — bubble right of trigger, arrow points left from the
//     bubble's left edge → white right edge, transparent top/bottom,
//     zero left edge.
//
// Tailwind v4's `before:` variant auto-injects `content: ""`, and the
// `data-[side=…]:` variant maps to the standard Base UI attribute,
// so the four chains compose cleanly.
const TOOLTIP_ARROW_CLASS =
  'before:absolute before:size-0 before:border-solid' +
  // top: arrow at bubble bottom edge, pointing down at the trigger below.
  ' data-[side=top]:before:left-1/2 data-[side=top]:before:-bottom-1.5 data-[side=top]:before:-ml-1.5' +
  ' data-[side=top]:before:border-x-[6px] data-[side=top]:before:border-t-[6px] data-[side=top]:before:border-b-0' +
  ' data-[side=top]:before:border-x-transparent data-[side=top]:before:border-t-white' +
  // bottom: arrow at bubble top edge, pointing up at the trigger above.
  ' data-[side=bottom]:before:left-1/2 data-[side=bottom]:before:-top-1.5 data-[side=bottom]:before:-ml-1.5' +
  ' data-[side=bottom]:before:border-x-[6px] data-[side=bottom]:before:border-b-[6px] data-[side=bottom]:before:border-t-0' +
  ' data-[side=bottom]:before:border-x-transparent data-[side=bottom]:before:border-b-white' +
  // left: arrow at bubble right edge, pointing right at the trigger.
  ' data-[side=left]:before:top-1/2 data-[side=left]:before:-right-1.5 data-[side=left]:before:-mt-1.5' +
  ' data-[side=left]:before:border-y-[6px] data-[side=left]:before:border-l-[6px] data-[side=left]:before:border-r-0' +
  ' data-[side=left]:before:border-y-transparent data-[side=left]:before:border-l-white' +
  // right: arrow at bubble left edge, pointing left at the trigger.
  ' data-[side=right]:before:top-1/2 data-[side=right]:before:-left-1.5 data-[side=right]:before:-mt-1.5' +
  ' data-[side=right]:before:border-y-[6px] data-[side=right]:before:border-r-[6px] data-[side=right]:before:border-l-0' +
  ' data-[side=right]:before:border-y-transparent data-[side=right]:before:border-r-white'

// Minimal internal context so `<TooltipContent>` picks the right
// `side` without repeating `placement` at every call site.
const PlacementContext = createContext<TooltipPlacement>('top')

export interface TooltipRootProps {
  children: ReactNode
  placement?: TooltipPlacement
}

export function TooltipRoot({ children, placement = 'top' }: TooltipRootProps) {
  // `delay: 0` matches the old implementation (show immediately on
  // hover/focus). We forward the `placement` via React context to the
  // content component so callers don't have to pass it twice.
  return (
    <BaseTooltip.Provider delay={0}>
      <BaseTooltip.Root>
        <PlacementContext.Provider value={placement}>{children}</PlacementContext.Provider>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}

// The prop bag extends `ButtonHTMLAttributes` (a superset of
// `HTMLAttributes`) so callers that pass `as="button"` can also set
// the button-specific `type="button"` attribute without a TypeScript
// error. Existing `as="h3"` / `as="sup"` / `as="span"` call sites
// only pass generic HTML attributes (`tabIndex`, `className`, spread
// `...props`), all of which remain valid on the wider type.
export interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLElement> {
  /** Element type to render. Defaults to `<span>` since tooltips usually wrap inline content. */
  as?: keyof React.JSX.IntrinsicElements
  children: ReactNode
}

// `TooltipTrigger` uses Base UI's `render` prop to keep the caller's
// chosen host element (e.g. `<h3 className="widget-title">`) and
// attributes while letting the library wire hover/focus/keyboard
// handlers. The default render is a `<button>`; by passing `render`
// we swap to any host element while the library still merges the
// correct `aria-describedby` / `data-popup-open` / handlers onto it.
export function TooltipTrigger({ as = 'span', children, ...rest }: TooltipTriggerProps) {
  const Comp = as as React.ElementType
  return <BaseTooltip.Trigger render={<Comp {...rest}>{children}</Comp>} />
}

export interface TooltipContentProps {
  children: ReactNode
}

// Renders the floating label through a portal. The visual chrome
// (white fill, drop shadow, ::before arrow) is composed from the
// `TOOLTIP_BASE_CLASS` + `TOOLTIP_ARROW_CLASS` constants above so the
// arrow / shadow / palette survive against the retired `tooltip.css`
// partial. The arrow geometry is gated on Base UI's `data-side`
// attribute (the resolved side AFTER collision avoidance), so a
// `placement="top"` bubble that flips to `bottom` near the viewport
// edge automatically swaps in the upward-pointing arrow on its top
// edge — no manual remap at the call site is needed.
//
// `Positioner` is the node Base UI absolutely-positions next to the
// trigger; `Popup` is its in-flow child. All visual chrome lives on
// `Popup`; the positioner stays unstyled so it doesn't fight the
// library's own `--available-width` / `--positioner-width` custom
// properties.
export function TooltipContent({ children }: TooltipContentProps) {
  const placement = use(PlacementContext)
  // Nothing to render when the content is empty/nullish — mirrors the
  // old `hasContent` short-circuit (no empty bubble on hover).
  if (children === null || children === undefined || children === false || children === '') {
    return null
  }
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={placement} sideOffset={8}>
        <BaseTooltip.Popup className={cn(TOOLTIP_BASE_CLASS, TOOLTIP_ARROW_CLASS)}>{children}</BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

// Compound-component namespace. Call sites compose `<Tooltip>` (the root,
// renamed `TooltipRoot` internally so consumers can spell it `Tooltip.Root`)
// with `Tooltip.Trigger` and `Tooltip.Content`.
export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
})
