import type { ComponentProps } from 'react'

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Checkbox({ className, ...props }: ComponentProps<typeof BaseCheckbox.Root>) {
  // Base UI's `Checkbox.Root` renders a `<span role="checkbox">`, not a
  // `<button>` like Radix does (intentional change to fix wrapping-label
  // a11y, see base-ui PR #3205). On a span, `width` / `height` from
  // `tw:size-4` are ignored unless we promote the box to a block-level
  // formatting context. Without `tw:inline-flex`, the box collapses to
  // a 1px tall vertical line in the rendered DOM (visible in the user
  // table screenshot before this fix).
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      className={cn(
        'tw:peer tw:border-input tw:dark:bg-input/30 tw:data-[checked]:bg-primary tw:data-[checked]:text-primary-foreground tw:dark:data-[checked]:bg-primary tw:data-[checked]:border-primary tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:aria-invalid:ring-destructive/20 tw:dark:aria-invalid:ring-destructive/40 tw:aria-invalid:border-destructive tw:inline-flex tw:size-4 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[4px] tw:border tw:shadow-xs tw:transition-shadow tw:outline-none tw:focus-visible:ring-[3px] tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        data-slot="checkbox-indicator"
        className="tw:flex tw:items-center tw:justify-center tw:text-current tw:transition-none"
      >
        <CheckIcon className="tw:size-3.5" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

export { Checkbox }
