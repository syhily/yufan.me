import type { ComponentProps } from 'react'

import { cn } from '@/ui/lib/cn'

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
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
