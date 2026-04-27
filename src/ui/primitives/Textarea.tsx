import type { ComponentPropsWithRef, Ref } from 'react'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Replaces `textarea.form-control` (legacy `_base.css`).
// Height auto + 0.625rem 0.75rem padding (legacy values).
export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={twMerge(
        clsx(
          'block w-full appearance-none bg-white text-foreground-muted border border-border rounded-sm text-sm leading-normal py-[0.625rem] px-3 placeholder:text-foreground-soft focus:text-foreground-soft focus:border-border-strong focus:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-surface-muted disabled:opacity-100 resize-none',
          className,
        ),
      )}
      {...props}
    />
  )
}
