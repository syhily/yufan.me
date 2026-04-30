import type { ComponentProps } from 'react'

import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/admin/shadcn/lib/utils'

const badgeVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:border tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:w-fit tw:whitespace-nowrap tw:shrink-0 tw:[&>svg]:size-3 tw:gap-1 tw:[&>svg]:pointer-events-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px] tw:aria-invalid:ring-destructive/20 tw:dark:aria-invalid:ring-destructive/40 tw:aria-invalid:border-destructive tw:transition-[color,box-shadow] tw:overflow-hidden',
  {
    variants: {
      variant: {
        default: 'tw:border-transparent tw:bg-primary tw:text-primary-foreground tw:[a&]:hover:bg-primary/90',
        secondary: 'tw:border-transparent tw:bg-secondary tw:text-secondary-foreground tw:[a&]:hover:bg-secondary/90',
        destructive:
          'tw:border-transparent tw:bg-destructive tw:text-white tw:[a&]:hover:bg-destructive/90 tw:focus-visible:ring-destructive/20 tw:dark:focus-visible:ring-destructive/40 tw:dark:bg-destructive/60',
        outline: 'tw:text-foreground tw:[a&]:hover:bg-accent tw:[a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  render?: useRender.RenderProp
}

function Badge({ className, variant, render, ...props }: BadgeProps) {
  return useRender({
    render: render ?? <span />,
    props: {
      'data-slot': 'badge',
      className: cn(badgeVariants({ variant }), className),
      ...props,
    },
  })
}

export { Badge, badgeVariants }
