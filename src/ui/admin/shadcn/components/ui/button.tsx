import type { ComponentProps } from 'react'

import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/admin/shadcn/lib/utils'

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
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-md tw:text-sm tw:font-medium tw:transition-colors tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg:not([class*=size-])]:size-4 tw:shrink-0 tw:[&_svg]:shrink-0 tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px] tw:aria-invalid:ring-destructive/20 tw:dark:aria-invalid:ring-destructive/40 tw:aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        // Brand teal at rest → dark navy on hover. Mirrors the public
        // site's `.btn-primary:hover` swap (`--btn-primary` →
        // `--btn-dark`), and matches the two reference screenshots the
        // user shared (resting teal vs. hover dark).
        default:
          'tw:bg-primary tw:text-primary-foreground tw:shadow-xs tw:hover:bg-foreground tw:hover:text-primary-foreground',
        // Same dark-navy hover lands on destructive too — the colour
        // shift is the visual cue that the action is firing.
        destructive:
          'tw:bg-destructive tw:text-white tw:shadow-xs tw:hover:bg-foreground tw:focus-visible:ring-destructive/20 tw:dark:focus-visible:ring-destructive/40',
        // Light-red "clear" affordance, modelled on the public site's
        // `.btn-outline-danger` (bg `#ffe8e8` / fg `#f7094c`, hovers to
        // solid `#f7094c` with white text). Used for tertiary "undo"
        // actions like clearing a filter selection — visible enough to
        // signal "removes something" without competing with primary
        // CTAs. The bg uses the destructive token at low alpha so it
        // tracks the admin theme automatically.
        'destructive-soft':
          'tw:bg-destructive/10 tw:text-destructive tw:hover:bg-destructive tw:hover:text-destructive-foreground tw:focus-visible:ring-destructive/20 tw:dark:focus-visible:ring-destructive/40',
        // outline / secondary / ghost stay on the lighter `accent`
        // hover so secondary actions don't compete with the primary
        // call-to-action when several buttons share a row (e.g. the
        // comment-row toolbar where "审核 / 回复 / …" all sit together).
        outline:
          'tw:border tw:bg-background tw:shadow-xs tw:hover:bg-accent tw:hover:text-accent-foreground tw:dark:bg-input/30 tw:dark:border-input tw:dark:hover:bg-input/50',
        secondary: 'tw:bg-secondary tw:text-secondary-foreground tw:shadow-xs tw:hover:bg-secondary/80',
        ghost: 'tw:hover:bg-accent tw:hover:text-accent-foreground',
        link: 'tw:text-primary tw:underline-offset-4 tw:hover:underline',
      },
      size: {
        default: 'tw:h-10 tw:px-5 tw:py-2.5',
        sm: 'tw:h-9 tw:rounded-md tw:gap-1.5 tw:px-3.5 tw:py-2',
        lg: 'tw:h-11 tw:rounded-md tw:px-7 tw:py-2.5',
        icon: 'tw:size-9',
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
