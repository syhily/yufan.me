import type { ComponentPropsWithRef, Ref } from 'react'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
      className={twMerge(
        clsx(
          'inline-block w-8 h-8 border-[0.25em] border-current border-r-transparent rounded-full animate-spinner align-text-bottom',
          className,
        ),
      )}
      {...props}
    >
      {children}
    </span>
  )
}
