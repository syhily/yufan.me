import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Replaces `.form-control` and `.form-control-lg` (legacy `_base.css`).
// Heights mirror the legacy 39px / 44px / 35px (mobile) so visual
// regressions are limited during migration.
const inputVariants = cva(
  'block w-full appearance-none bg-white text-foreground-muted border border-border rounded-sm font-normal leading-normal placeholder:text-foreground-soft focus:text-foreground-soft focus:border-border-strong focus:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-surface-muted disabled:opacity-100',
  {
    variants: {
      size: {
        md: 'text-sm h-[39px] py-[0.375rem] px-3 max-md:h-[35px]',
        lg: 'text-[0.9375rem] h-[44px] py-2 px-4 max-md:text-sm max-md:h-[39px] max-md:px-[0.875rem]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export type InputVariantProps = VariantProps<typeof inputVariants>

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'>, InputVariantProps {
  ref?: Ref<HTMLInputElement>
}

export function Input({ className, size, type, ref, ...props }: InputProps) {
  return (
    <input ref={ref} type={type ?? 'text'} className={twMerge(clsx(inputVariants({ size }), className))} {...props} />
  )
}

export { inputVariants }
