import type { ComponentPropsWithRef } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

// Centred page container.
//
// Replaces every per-file copy of `BOOTSTRAP_CONTAINER_CLASS` /
// `SITE_CONTAINER_CLASS` across the codebase with a single primitive that
// uses Tailwind's project-level breakpoints (`sm` 576 / `md` 768 / `lg` 992
// / `xl` 1200 / `2xl` 1400, configured via `@theme` in `globals.css`).
// The five Bootstrap-era min-width breakpoint thresholds now live
// exclusively inside this file's variants and are spelled with the named
// variants below (`sm:` / `md:` / `lg:` / `xl:` / `2xl:`).
//
// Sizes track the design system's three host shapes:
//
//   - `default` — the listing/detail/site shell (max-w 1320 at 2xl).
//   - `narrow`  — single-column screens (admin login, simple forms);
//                 caps at 960 so long forms don't sprawl on desktops.
//   - `wide`    — long content shells (archives) that benefit from
//                 a larger 2xl ceiling without disrupting the default
//                 site rhythm.
//   - `fluid`   — `mx-auto` with no max-width, for chrome that owns
//                 its own bounds.
const containerVariants = cva('mx-auto w-full px-3', {
  variants: {
    size: {
      default:
        'sm:max-w-container-sm md:max-w-container-md lg:max-w-container-lg xl:max-w-container-xl 2xl:max-w-container-2xl',
      narrow: 'sm:max-w-container-sm md:max-w-container-md lg:max-w-container-lg',
      wide: 'sm:max-w-container-sm md:max-w-container-md lg:max-w-container-lg xl:max-w-container-xl 2xl:max-w-container-3xl',
      fluid: '',
    },
  },
  defaultVariants: { size: 'default' },
})

export interface ContainerProps
  extends Omit<ComponentPropsWithRef<'div'>, 'className'>, VariantProps<typeof containerVariants> {
  className?: string
}

export function Container({ size, className, children, ...props }: ContainerProps) {
  return (
    <div className={cn(containerVariants({ size }), className)} {...props}>
      {children}
    </div>
  )
}
