import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { type Tone, TONE_OUTLINE } from '@/ui/primitives/tone'

// Alert is the "outline-tinted" cousin of Badge — same colour table,
// rendered as a banner. Hover states are filtered out at use-time
// because Alert is non-interactive (no pointer cursor, no focus ring),
// so we only need the static surface of `TONE_OUTLINE`.
const alertVariants = cva('relative mb-4 py-3 px-4 border rounded-sm', {
  variants: {
    tone: {
      accent: '',
      neutral: '',
      inverse: '',
      success: '',
      danger: '',
      warning: '',
      subtle: '',
    } satisfies Record<Tone, string>,
  },
  compoundVariants: (Object.entries(TONE_OUTLINE) as [Tone, string][]).map(([tone, cls]) => ({
    tone,
    // Alert is non-interactive: strip the hover utility prefixes so the
    // banner doesn't shift when readers happen to hover over it.
    class: cls.replace(/\bhover:[^\s]+/g, '').trim(),
  })),
  defaultVariants: {
    tone: 'danger',
  },
})

export type AlertVariantProps = VariantProps<typeof alertVariants>

export interface AlertProps extends ComponentPropsWithRef<'div'>, AlertVariantProps {
  ref?: Ref<HTMLDivElement>
}

export function Alert({ className, tone, role, ref, ...props }: AlertProps) {
  return (
    <div ref={ref} role={role ?? 'alert'} className={twMerge(clsx(alertVariants({ tone }), className))} {...props} />
  )
}

export { alertVariants }
