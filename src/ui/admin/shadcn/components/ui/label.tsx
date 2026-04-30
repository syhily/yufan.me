import type { ComponentProps } from 'react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

// Generic shadcn label primitive — consumers always supply either an
// `htmlFor` pointing at a sibling control or wrap the label around the
// control directly. The accessibility rule cannot statically prove that
// here, so it is silenced for this single base component.
function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot="label"
      className={cn(
        'tw:flex tw:items-center tw:gap-2 tw:text-sm tw:leading-none tw:font-medium tw:select-none tw:group-data-[disabled=true]:pointer-events-none tw:group-data-[disabled=true]:opacity-50 tw:peer-disabled:cursor-not-allowed tw:peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
