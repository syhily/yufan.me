import type { ComponentPropsWithRef, Ref } from 'react'

import { cn } from '@/ui/lib/cn'

// Lightweight skeleton primitive. The static gradient + animation
// keyframes live on the `.skeleton-shimmer` class in
// `@layer utilities` (see `globals.css`), and we add `animate-shimmer`
// for the moving `background-position` interpolation.
//
// The primitive intentionally stays a `<div>`. Callers control width
// and height through Tailwind utilities (`w-3/4`, `h-4`, etc.) so the
// home post-listing skeleton, the comments fallback, and any future
// surface can share the recipe without adding boolean prop matrices.
export interface SkeletonProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
}

export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      className={cn('skeleton-shimmer animate-shimmer rounded', className)}
      aria-hidden="true"
      {...props}
    />
  )
}
