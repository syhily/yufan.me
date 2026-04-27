import type { ComponentPropsWithRef, Ref } from 'react'

import { cn } from '@/ui/lib/cn'

// Replaces `.spinner-border` (legacy bootstrap shim). The keyframes and
// the `--animate-spinner` token both live in `globals.css` now.
export interface SpinnerProps extends ComponentPropsWithRef<'span'> {
  ref?: Ref<HTMLSpanElement>
}

export function Spinner({ className, role, children, ref, ...props }: SpinnerProps) {
  return (
    <span
      ref={ref}
      role={role ?? 'status'}
      className={cn(
        'inline-block w-8 h-8 border-[0.25em] border-current border-r-transparent rounded-full animate-spinner align-text-bottom',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
