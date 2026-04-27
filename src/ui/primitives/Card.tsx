import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

// Brand-card recipe used by post listings, friends, categories, and the
// post/page detail shells. The shadow comes from the `--shadow-brand-card`
// token in `globals.css` so all six call sites share one source of truth
// (no more `rgb(40_49_73/0.02)` vs `rgba(40,49,73,0.02)` drift).
//
// Three orthogonal axes:
//
//   - `orientation`: stacked card (`col`, default) vs the listing row card
//     (`row`, used by `PostCards` on home).
//   - `density`: `none` for surfaces that own their own vertical rhythm
//     (post detail, admin dashboards), `tight` for sidebar cards, `listing`
//     (default) for the home/category/tag/friends grid spacing.
//   - `size`: kept for `<CardBody size="md">` callers that opt into the
//     larger internal padding (post detail uses this).
const cardVariants = cva('relative flex min-w-0 break-words border-0 rounded-none bg-white shadow-brand-card', {
  variants: {
    orientation: {
      col: 'flex-col',
      row: 'flex-row flex-auto',
    },
    density: {
      none: '',
      tight: 'mb-3',
      listing: 'mb-3 md:mb-5 2xl:mb-7',
    },
    size: {
      sm: '',
      md: '',
    },
  },
  defaultVariants: {
    orientation: 'col',
    density: 'listing',
    size: 'sm',
  },
})

export type CardVariantProps = VariantProps<typeof cardVariants>

export interface CardProps extends ComponentPropsWithRef<'div'>, CardVariantProps {
  ref?: Ref<HTMLDivElement>
}

export function Card({ className, orientation, density, size, ref, ...props }: CardProps) {
  return <div ref={ref} className={cn(cardVariants({ orientation, density, size }), className)} {...props} />
}

export interface CardBodyProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
  /** When the parent `<Card size="md">`, opts the body into 2rem padding. */
  size?: 'sm' | 'md'
}

export function CardBody({ className, size, ref, ...props }: CardBodyProps) {
  return <div ref={ref} className={cn('flex-auto', size === 'md' ? 'p-4 md:p-8' : 'p-4', className)} {...props} />
}

export { cardVariants }
