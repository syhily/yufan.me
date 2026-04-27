import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { type Tone, TONE_SOLID } from '@/ui/primitives/tone'

// Badge collapses to 3 dimensions: `tone` × `size` × `shape`. Colours
// route through the shared `TONE_SOLID` table so a "tighten the neutral
// chip" change applies to Button / Alert / Pagination at the same time.
//
// Sizes preserve the prior 0.625rem font + 0.125rem/0.375rem paddings so
// swapping in `<Badge>` at a call site does not change rendered metrics
// for the listing card / sidebar pills.
const badgeVariants = cva(
  'inline-flex items-center font-normal align-middle leading-tight whitespace-nowrap shadow-none outline-none',
  {
    variants: {
      tone: {
        accent: '',
        neutral: '',
        inverse: '',
        success: '',
        danger: '',
        warning: '',
        subtle: '',
      } satisfies Record<Tone, string>,
      size: {
        xs: 'text-[0.625rem] py-0.5 px-2.5 max-xl:text-[9px] max-xl:py-[0.3125rem] max-xl:px-2',
        sm: 'text-xs py-1 px-[0.35rem]',
        md: 'text-xs py-[0.4375rem] px-2.5',
      },
      shape: {
        rect: 'rounded-none',
        pill: 'rounded-[10rem] py-[0.375rem] px-3',
      },
    },
    compoundVariants: (Object.entries(TONE_SOLID) as [Tone, string][]).map(([tone, cls]) => ({
      tone,
      class: cls,
    })),
    defaultVariants: {
      tone: 'accent',
      size: 'xs',
      shape: 'rect',
    },
  },
)

export type BadgeVariantProps = VariantProps<typeof badgeVariants>

export interface BadgeProps extends ComponentPropsWithRef<'span'>, BadgeVariantProps {
  ref?: Ref<HTMLSpanElement>
}

export function Badge({ className, tone, size, shape, ref, ...props }: BadgeProps) {
  return <span ref={ref} className={twMerge(clsx(badgeVariants({ tone, size, shape }), className))} {...props} />
}

export { badgeVariants }
