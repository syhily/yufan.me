import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Replaces `.card / .card-md / .block` (legacy `_base.css`) and the
// bootstrap compatibility shim. The `block` variant matches
// `.block` (used by listings and aside widgets); `card` matches `.card`
// (used by the post detail shell and admin widgets). The `md` size opts in
// to the legacy `.card-md .card-body { padding: 2rem }` rule.
const cardVariants = cva(
  'relative flex flex-col min-w-0 break-words border-0 rounded-none bg-white mb-3 md:mb-5 2xl:mb-7 shadow-[0_0_30px_0_rgba(40,49,73,0.02)]',
  {
    variants: {
      size: {
        sm: '',
        md: '',
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  },
)

export type CardVariantProps = VariantProps<typeof cardVariants>

export interface CardProps extends ComponentPropsWithRef<'div'>, CardVariantProps {
  ref?: Ref<HTMLDivElement>
}

export function Card({ className, size, ref, ...props }: CardProps) {
  return <div ref={ref} className={twMerge(clsx(cardVariants({ size }), className))} {...props} />
}

export interface CardBodyProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
  /** When the parent `<Card size="md">`, opts the body into 2rem padding. */
  size?: 'sm' | 'md'
}

export function CardBody({ className, size, ref, ...props }: CardBodyProps) {
  return (
    <div ref={ref} className={twMerge(clsx('flex-auto', size === 'md' ? 'p-4 md:p-8' : 'p-4', className))} {...props} />
  )
}

export { cardVariants }
