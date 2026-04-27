import type { ComponentPropsWithRef } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

// Non-MDX heading primitive.
//
// MDX bodies use `prose.tsx`'s `<H1>..<H6>` (with anchor + indicator bar).
// Routes and listing components write headings directly (`<h1>{title}</h1>`)
// and historically inherited their font sizes from `globals.css`'s `@layer
// base` ruleset. This primitive replaces that inheritance so the base layer
// can shrink to ~45 lines.
//
// Sizes mirror the legacy base-layer cascade:
//
//   level | max-md (≤767px) | md (768-991px) | lg (992-1199px) | xl (1200+)
//   ------+-----------------+----------------+-----------------+-----------
//   1     | 1.5rem          | 1.625rem       | 1.75rem         | 1.75rem
//   2     | 1.25rem         | 1.375rem       | 1.5rem          | 1.5rem
//   3     | 1.125rem        | 1.125rem       | 1.375rem        | 1.375rem
//   4     | 1rem            | 1rem           | 1.25rem         | 1.25rem
//   5     | 0.9375rem       | 1rem           | 1.125rem        | 1.125rem
//   6     | 0.9375rem       | 1rem           | 1rem            | 1rem
//
// (At 2xl the legacy base layer never overrode h1, so it fell back to the
// default `font-size: 1.5rem` declared at the top of the cascade. We keep
// the same intent here by stopping at xl and letting the lg/xl values
// continue to apply.)
const headingVariants = cva('font-semibold text-foreground leading-tight', {
  variants: {
    level: {
      1: 'text-[1.5rem] md:text-[1.625rem] lg:text-[1.75rem]',
      2: 'text-[1.25rem] md:text-[1.375rem] lg:text-[1.5rem]',
      3: 'text-[1.125rem] lg:text-[1.375rem]',
      4: 'text-base lg:text-[1.25rem]',
      5: 'text-[0.9375rem] md:text-base lg:text-[1.125rem]',
      6: 'text-[0.9375rem] md:text-base',
    },
  },
  defaultVariants: { level: 1 },
})

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export interface HeadingProps
  extends Omit<ComponentPropsWithRef<HeadingTag>, 'className'>, VariantProps<typeof headingVariants> {
  className?: string
  /** Override the rendered HTML tag (rarely needed). */
  as?: HeadingTag
}

export function Heading({ level = 1, as, className, children, ...props }: HeadingProps) {
  const Tag = (as ?? `h${level}`) as HeadingTag
  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props}>
      {children}
    </Tag>
  )
}
