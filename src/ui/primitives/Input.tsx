import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

// Replaces `.form-control` and `.form-control-lg` (legacy `_base.css`).
// Heights mirror the legacy 39px / 44px / 35px (mobile) so visual
// regressions are limited during migration.
const inputVariants = cva(
  'block w-full appearance-none bg-white text-foreground-muted border border-border rounded-sm font-normal leading-normal placeholder:text-foreground-soft focus:text-foreground-soft focus:border-border-strong focus:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-surface-muted disabled:opacity-100',
  {
    variants: {
      size: {
        md: 'text-sm h-[35px] py-[0.375rem] px-3 md:h-[39px]',
        lg: 'text-sm h-[39px] py-2 px-[0.875rem] md:text-[0.9375rem] md:h-[44px] md:px-4',
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
  return <input ref={ref} type={type ?? 'text'} className={cn(inputVariants({ size }), className)} {...props} />
}

export { inputVariants }
