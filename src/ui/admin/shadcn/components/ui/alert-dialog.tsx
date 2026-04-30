import type { ComponentProps } from 'react'

import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'

import { Button, buttonVariants } from '@/ui/admin/shadcn/components/ui/button'
import { cn } from '@/ui/admin/shadcn/lib/utils'

function AlertDialog({ ...props }: ComponentProps<typeof BaseAlertDialog.Root>) {
  return <BaseAlertDialog.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: ComponentProps<typeof BaseAlertDialog.Trigger>) {
  return <BaseAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: ComponentProps<typeof BaseAlertDialog.Portal>) {
  return <BaseAlertDialog.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogBackdrop({ className, ...props }: ComponentProps<typeof BaseAlertDialog.Backdrop>) {
  return (
    <BaseAlertDialog.Backdrop
      data-slot="alert-dialog-backdrop"
      className={cn(
        'tw:data-[ending-style]:opacity-0 tw:data-[starting-style]:opacity-0 tw:fixed tw:inset-0 tw:z-50 tw:bg-black/50 tw:transition-opacity tw:duration-150',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, ...props }: ComponentProps<typeof BaseAlertDialog.Popup>) {
  return (
    <AlertDialogPortal>
      <AlertDialogBackdrop />
      <BaseAlertDialog.Popup
        data-slot="alert-dialog-content"
        className={cn(
          'tw:bg-background tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:fixed tw:top-[50%] tw:left-[50%] tw:z-50 tw:grid tw:w-full tw:max-w-[calc(100%-2rem)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:gap-4 tw:rounded-lg tw:border tw:p-6 tw:shadow-lg tw:duration-200 tw:sm:max-w-lg',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('tw:flex tw:flex-col tw:gap-2 tw:text-center tw:sm:text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn('tw:flex tw:flex-col-reverse tw:gap-2 tw:sm:flex-row tw:sm:justify-end', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: ComponentProps<typeof BaseAlertDialog.Title>) {
  return (
    <BaseAlertDialog.Title
      data-slot="alert-dialog-title"
      className={cn('tw:text-lg tw:font-semibold', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: ComponentProps<typeof BaseAlertDialog.Description>) {
  return (
    <BaseAlertDialog.Description
      data-slot="alert-dialog-description"
      className={cn('tw:text-muted-foreground tw:text-sm', className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Close> & ComponentProps<typeof Button>) {
  return (
    <BaseAlertDialog.Close data-slot="alert-dialog-action" className={cn(buttonVariants(), className)} {...props} />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Close> & ComponentProps<typeof Button>) {
  return (
    <BaseAlertDialog.Close
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBackdrop,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
