import type { ComponentProps } from 'react'

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

// Admin Pagination ----------------------------------------------------
//
// Visual contract is anchored to the public site's `.page-numbers`
// pattern (see `src/assets/styles/_base.css` § Pagination):
//   * Each entry is a fixed 2.5rem circle (`tw:size-10 tw:rounded-full`).
//   * Resting state is a dark navy fill on white text — matches the
//     site's `.nav-links .page-numbers { background-color: #283248 }`,
//     which we reach via the admin token `--foreground` (`#151b2b`).
//   * Hover and the current page swap to the brand teal `#008c95`
//     (admin `--primary`), white text. Same swap as the public
//     `.page-numbers:hover, .page-numbers.current` rule.
//   * Ellipsis uses the same dark chip but stays non-interactive (no
//     hover swap), matching `.page-numbers.dots` on the public site.
//   * Prev/Next are circular icon-only chips (no labels). The
//     existing public pagination doesn't render them either, so this
//     keeps the two views visually congruent.
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
      className={cn('tw:mx-auto tw:flex tw:w-full tw:justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('tw:flex tw:flex-row tw:flex-wrap tw:items-center tw:justify-center tw:gap-2', className)}
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
const chipBase =
  'tw:inline-flex tw:size-10 tw:items-center tw:justify-center tw:rounded-full tw:text-sm tw:font-medium tw:select-none tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring/60 tw:focus-visible:ring-offset-2 tw:focus-visible:ring-offset-background tw:disabled:pointer-events-none tw:disabled:opacity-40'

const chipResting = 'tw:bg-foreground tw:text-primary-foreground tw:hover:bg-primary tw:hover:text-primary-foreground'

const chipActive = 'tw:bg-primary tw:text-primary-foreground tw:hover:bg-primary'

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
      <ChevronLeftIcon className="tw:size-4" />
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }: ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="下一页" className={className} {...props}>
      <ChevronRightIcon className="tw:size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(chipBase, chipResting, 'tw:cursor-default tw:hover:bg-foreground', className)}
      {...props}
    >
      <MoreHorizontalIcon className="tw:size-4" />
      <span className="tw:sr-only">更多</span>
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
