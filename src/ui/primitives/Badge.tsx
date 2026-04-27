import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'
import { TONE_VARIANTS } from '@/ui/primitives/tone'
import { ToneSurface } from '@/ui/primitives/ToneSurface'

// Badge has 3 dimensions: `tone` × `size` × `shape`. Colours are
// always `solid`, so the host element renders with
// `data-appearance="solid" data-tone={tone}` — the tone × appearance
// cells in `toneStyles.css` paint the bg / text / border / hover.
//
// Sizes preserve the prior 0.625rem font + 0.125rem/0.375rem paddings so
// swapping in `<Badge>` at a call site does not change rendered metrics
// for the listing card / sidebar pills.
const badgeVariants = cva(
  'inline-flex items-center font-normal align-middle leading-tight whitespace-nowrap shadow-none outline-none',
  {
    variants: {
      tone: TONE_VARIANTS,
      size: {
        xs: 'text-[9px] py-[0.3125rem] px-2 xl:text-[0.625rem] xl:py-0.5 xl:px-2.5',
        sm: 'text-xs py-1 px-[0.35rem]',
        md: 'text-xs py-[0.4375rem] px-2.5',
      },
      shape: {
        rect: 'rounded-none',
        pill: 'rounded-[10rem] py-[0.375rem] px-3',
      },
    },
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
  return (
    <ToneSurface
      as="span"
      tone={tone ?? 'accent'}
      appearance="solid"
      ref={ref}
      className={cn(badgeVariants({ tone, size, shape }), className)}
      {...props}
    />
  )
}

export { badgeVariants }
