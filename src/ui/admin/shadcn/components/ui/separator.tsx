import type { ComponentProps } from 'react'

import { Separator as BaseSeparator } from '@base-ui/react/separator'

import { cn } from '@/ui/admin/shadcn/lib/utils'

type SeparatorProps = ComponentProps<typeof BaseSeparator>

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <BaseSeparator
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'tw:bg-border tw:shrink-0 tw:data-[orientation=horizontal]:h-px tw:data-[orientation=horizontal]:w-full tw:data-[orientation=vertical]:h-full tw:data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
