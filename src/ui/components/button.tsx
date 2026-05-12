import type { ComponentProps } from 'react'

import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

// Button variants tuned to match the public site's `.btn` rules in
// `src/assets/styles/_base.css`:
//
// 1. Generous horizontal padding (`px-5` ≈ 20px, vs upstream shadcn's
//    16px) so labels never feel cramped against the button edge. The
//    public site uses 0.375rem 1.625rem (6×26px); we land slightly more
//    compressed because admin chrome packs more controls per row.
// 2. `has-[>svg]:px-*` — DROPPED. shadcn's upstream collapses the
//    horizontal padding when an SVG is present, but virtually every
//    admin button is "icon + label" so that rule made every action
//    button look squeezed. Padding now stays uniform across icon-only
//    and icon+label buttons; icon-only callers still use `size: 'icon'`
//    which sets `size-9` and is square by design.
// 3. `default` hover changes the background to `bg-foreground` (the
//    dark navy `#151b2b` that matches the site's `--btn-dark` token)
//    instead of dimming the brand teal via `/90`. Same pattern for
//    `destructive` — hover swaps to the dark navy, telegraphing the
//    "this action is irreversible" vibe consistent with the public
//    site's btn-primary:hover behaviour.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 [&_[data-icon]]:size-4 [&_[data-icon=sm]]:size-3 [&_[data-icon=lg]]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        // Brand teal at rest → dark navy on hover. Mirrors the public
        // site's `.btn-primary:hover` swap (`--btn-primary` →
        // `--btn-dark`), and matches the two reference screenshots the
        // user shared (resting teal vs. hover dark).
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-foreground hover:text-primary-foreground',
        // Same dark-navy hover lands on destructive too — the colour
        // shift is the visual cue that the action is firing.
        destructive: 'bg-destructive text-white shadow-xs hover:bg-foreground focus-visible:ring-destructive/20',
        // Light-red "clear" affordance — used for tertiary "undo"
        // actions like clearing a filter selection: visible enough to
        // signal "removes something" without competing with primary
        // CTAs. The bg uses the destructive token at low alpha so it
        // tracks the admin theme automatically. Modelled on a
        // historical public-site outline-danger look (`#ffe8e8`
        // background, `#f7094c` foreground); admin is the only
        // surviving consumer.
        'destructive-soft':
          'bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive/20',
        // outline / secondary / ghost stay on the lighter `accent`
        // hover so secondary actions don't compete with the primary
        // call-to-action when several buttons share a row (e.g. the
        // comment-row toolbar where "审核 / 回复 / …" all sit together).
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground ',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2.5',
        sm: 'h-9 rounded-md gap-1.5 px-3.5 py-2',
        lg: 'h-11 rounded-md px-7 py-2.5',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  render?: useRender.RenderProp
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  // Use Base UI's `defaultTagName` to provide the fallback element (a
  // plain `<button>`) and put defaults — including `type="button"` —
  // into the `props` bag. `useRender` treats the render element as the
  // user-supplied template whose props win over `props`; if we put
  // `type="button"` inside `<button type="button" />`, a caller's
  // `type="submit"` would be silently ignored, breaking form submits
  // (#admin-save-no-submit). Putting it in `props` lets the spread
  // order (`...props` last) override it cleanly.
  const element = useRender({
    defaultTagName: 'button',
    render,
    props: {
      type: 'button',
      'data-slot': 'button',
      ...props,
      className: cn(buttonVariants({ variant, size, className })),
    },
  })
  return element
}

export { Button, buttonVariants }
