import type { ComponentProps } from 'react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'tw:bg-card tw:text-card-foreground tw:flex tw:flex-col tw:gap-6 tw:rounded-xl tw:border tw:py-6 tw:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'tw:@container/card-header tw:grid tw:auto-rows-min tw:grid-rows-[auto_auto] tw:items-start tw:gap-1.5 tw:px-6 tw:has-data-[slot=card-action]:grid-cols-[1fr_auto] tw:[.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('tw:leading-none tw:font-semibold', className)} {...props} />
}

function CardDescription({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card-description" className={cn('tw:text-muted-foreground tw:text-sm', className)} {...props} />
  )
}

function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('tw:col-start-2 tw:row-span-2 tw:row-start-1 tw:self-start tw:justify-self-end', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('tw:px-6', className)} {...props} />
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('tw:flex tw:items-center tw:px-6 tw:[.border-t]:pt-6', className)}
      {...props}
    />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
