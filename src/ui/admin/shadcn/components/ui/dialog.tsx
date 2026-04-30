import type { ComponentProps } from 'react'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Dialog({ ...props }: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="dialog-close" {...props} />
}

function DialogBackdrop({ className, ...props }: ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        'tw:data-[ending-style]:opacity-0 tw:data-[starting-style]:opacity-0 tw:fixed tw:inset-0 tw:z-50 tw:bg-black/50 tw:transition-opacity tw:duration-150',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof BaseDialog.Popup> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <BaseDialog.Popup
        data-slot="dialog-content"
        className={cn(
          'tw:bg-background tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:fixed tw:top-[50%] tw:left-[50%] tw:z-50 tw:grid tw:w-full tw:max-w-[calc(100%-2rem)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:gap-4 tw:rounded-lg tw:border tw:p-6 tw:shadow-lg tw:duration-200 tw:sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close
            data-slot="dialog-close"
            className="tw:ring-offset-background tw:focus:ring-ring tw:absolute tw:top-4 tw:right-4 tw:rounded-xs tw:opacity-70 tw:transition-opacity tw:hover:opacity-100 tw:focus:ring-2 tw:focus:ring-offset-2 tw:focus:outline-hidden tw:disabled:pointer-events-none tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4"
          >
            <XIcon />
            <span className="tw:sr-only">关闭</span>
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('tw:flex tw:flex-col tw:gap-2 tw:text-center tw:sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('tw:flex tw:flex-col-reverse tw:gap-2 tw:sm:flex-row tw:sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="dialog-title"
      className={cn('tw:text-lg tw:leading-none tw:font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="dialog-description"
      className={cn('tw:text-muted-foreground tw:text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
