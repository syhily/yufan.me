import type { ComponentProps } from 'react'

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'

import { cn } from '@/ui/lib/cn'

// Pagination chip primitives ------------------------------------------
//
// Shared between the admin shell (`src/ui/admin/shared/AdminPagination.tsx`)
// and the public site (`src/ui/post/pagination/Pagination.tsx`). The
// chip class chain (`chipBase`, `chipResting`, `chipActive` below) is
// the canonical visual contract — both surfaces compose it onto their
// preferred element shape (admin: `<button>` with `onClick`; public:
// `<Link>` for navigation + `<span>` for current/ellipsis).
//
// Visual specification:
//   * Each chip is a fixed 2.5rem circle (`size-10 rounded-full`).
//   * Resting state is a dark navy fill on white text via the
//     `--foreground` token (`#151b2b`, registered at `:root` in
//     `admin-theme.css`).
//   * Hover and the current page swap to the brand teal via
//     `--primary` (`#008c95`).
//   * Ellipsis stays on the resting palette and suppresses the hover
//     swap (overridden by callers — see `PaginationEllipsis` below
//     and the public `Ellipsis` helper).
//   * Focus-visible state telegraphs the brand teal as a 2px ring
//     offset by 2px against the surface.
//
// PaginationPrevious / PaginationNext are kept as opt-in API but
// neither admin nor public renders them today — admin used to (stage
// 3c-ii dropped them so admin matches the public layout that has
// never carried prev/next chips). Future callers that want chevron
// chips can still import the two helpers below.
//
// We deliberately don't route through the shared `Button` component
// here: that component carries `--shadow-xs`, transition tokens, the
// default `bg-primary` resting state, and `px-5` padding from the
// admin button redesign — none of which fit a tight circular chip
// row. Composing styles directly keeps the chip exactly 40×40 and
// avoids hovering-shadow artefacts the user has called out before.

function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row flex-wrap items-center justify-center gap-2', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

// Shared chip class. Keep the layering deliberate so `tailwind-merge`
// (with `tw` prefix) cleanly resolves the active vs. resting variants
// when callers pass extra `className` overrides.
//
// Exported so the public-site pagination
// (`src/ui/post/pagination/Pagination.tsx`) can dress its `<Link>` /
// `<span>` chips with the SAME utility chain admin uses on its
// `<button>` chips. Both surfaces resolve `bg-foreground`,
// `bg-primary`, `text-primary-foreground`, `ring-ring/60`,
// `ring-offset-background` against the same `:root` aliases declared in
// `tailwind.css`, so the chip renders identically on both surfaces.
//
// Caveat: the `disabled:*` modifiers are inert on `<Link>` / `<span>`
// (only `<button>` / form controls match `:disabled`), but harmless. We
// keep them in `chipBase` so admin's `<button>` callers don't lose the
// disabled affordance.
export const chipBase =
  'inline-flex size-10 items-center justify-center rounded-full text-sm font-medium select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40'

// Light mode keeps the original "dark navy chip on white text" via the
// `foreground` <-> `background` pair. Dark mode would invert that to a
// light-grey chip (because `--foreground` flips to the light ink), which the
// user reported as "too pale to read". The `dark:` overrides park the chip
// on an elevated dark surface (`surface-dim`) with light ink so the page
// number stays readable against the deep navy canvas.
export const chipResting =
  'bg-foreground text-background hover:bg-primary hover:text-primary-foreground dark:bg-surface-dim dark:text-ink-strong dark:hover:text-primary-foreground'

export const chipActive = 'bg-primary text-primary-foreground hover:bg-primary'

interface PaginationLinkProps extends ComponentProps<'button'> {
  isActive?: boolean
}

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  // Pagination chips never participate in form submission; the lint
  // rule `react/button-has-type` requires a literal value, so pin to
  // `"button"`. Callers don't need to override this.
  return (
    <button
      type="button"
      data-slot="pagination-link"
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive}
      className={cn(chipBase, isActive ? chipActive : chipResting, className)}
      {...props}
    />
  )
}

function PaginationPrevious({ className, ...props }: ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="上一页" className={className} {...props}>
      <ChevronLeftIcon className="size-4" />
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }: ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="下一页" className={className} {...props}>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(chipBase, chipResting, 'cursor-default hover:bg-foreground', className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">更多</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
