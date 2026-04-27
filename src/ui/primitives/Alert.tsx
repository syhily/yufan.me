import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'
import { TONE_VARIANTS } from '@/ui/primitives/tone'
import { ToneSurface } from '@/ui/primitives/ToneSurface'

// Alert is the outline-tinted cousin of Badge — non-interactive banner
// rendered with `data-appearance="outline"`. We tag the host with
// `data-static="true"` so the `:hover:not([data-static])` rules in
// `toneStyles.css` skip us at the cascade level — no className
// gymnastics, no regex strip.
const alertVariants = cva('relative mb-4 py-3 px-4 border rounded-sm', {
  variants: {
    tone: TONE_VARIANTS,
  },
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
    <ToneSurface
      as="div"
      tone={tone ?? 'danger'}
      appearance="outline"
      static
      ref={ref}
      role={role ?? 'alert'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  )
}

export { alertVariants }
