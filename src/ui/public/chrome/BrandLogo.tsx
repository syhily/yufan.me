import type { ImgHTMLAttributes } from 'react'

import { cn } from '@/ui/lib/cn'

// Shared brand wordmark renderer for the wide `/logo-large.svg`. Renders two
// `<img>` tags layered on top of each other and toggled by the `dark:` Tailwind
// variant so the swap happens before hydration and SSR ships the right image
// from the start. Both sources are intentionally siblings of the same width so
// the box reservation is identical and there is no layout shift on theme flip.
export interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  className?: string
}

export function BrandLogo({ className, alt = '且听书吟', ...rest }: BrandLogoProps) {
  return (
    <>
      <img src="/logo-large.svg" alt={alt} className={cn('block dark:hidden', className)} {...rest} />
      <img src="/logo-large-dark.svg" alt={alt} className={cn('hidden dark:block', className)} aria-hidden {...rest} />
    </>
  )
}
