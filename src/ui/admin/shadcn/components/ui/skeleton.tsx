import type { ComponentProps } from 'react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" className={cn('tw:bg-accent tw:animate-pulse tw:rounded-md', className)} {...props} />
  )
}

export { Skeleton }
