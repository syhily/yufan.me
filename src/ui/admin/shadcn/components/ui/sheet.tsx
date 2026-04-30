import type { ComponentProps } from 'react'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Sheet({ ...props }: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal data-slot="sheet-portal" {...props} />
}

function SheetBackdrop({ className, ...props }: ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        'tw:data-[ending-style]:opacity-0 tw:data-[starting-style]:opacity-0 tw:fixed tw:inset-0 tw:z-50 tw:bg-black/50 tw:transition-opacity tw:duration-200',
        className,
      )}
      {...props}
    />
  )
}

const sideClasses = {
  right:
    'tw:inset-y-0 tw:right-0 tw:h-full tw:w-3/4 tw:border-l tw:sm:max-w-sm tw:data-[starting-style]:translate-x-full tw:data-[ending-style]:translate-x-full',
  left: 'tw:inset-y-0 tw:left-0 tw:h-full tw:w-3/4 tw:border-r tw:sm:max-w-sm tw:data-[starting-style]:-translate-x-full tw:data-[ending-style]:-translate-x-full',
  top: 'tw:inset-x-0 tw:top-0 tw:h-auto tw:border-b tw:data-[starting-style]:-translate-y-full tw:data-[ending-style]:-translate-y-full',
  bottom:
    'tw:inset-x-0 tw:bottom-0 tw:h-auto tw:border-t tw:data-[starting-style]:translate-y-full tw:data-[ending-style]:translate-y-full',
} as const

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: ComponentProps<typeof BaseDialog.Popup> & { side?: keyof typeof sideClasses }) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <BaseDialog.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'tw:bg-background tw:fixed tw:z-50 tw:flex tw:flex-col tw:gap-4 tw:shadow-lg tw:transition tw:duration-300 tw:ease-in-out',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close
          data-slot="sheet-close-button"
          className="tw:ring-offset-background tw:focus:ring-ring tw:absolute tw:top-4 tw:right-4 tw:rounded-xs tw:opacity-70 tw:transition-opacity tw:hover:opacity-100 tw:focus:ring-2 tw:focus:ring-offset-2 tw:focus:outline-hidden tw:disabled:pointer-events-none tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4"
        >
          <XIcon />
          <span className="tw:sr-only">关闭</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:p-4', className)} {...props} />
}

function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('tw:mt-auto tw:flex tw:flex-col tw:gap-2 tw:p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="sheet-title"
      className={cn('tw:text-foreground tw:font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="sheet-description"
      className={cn('tw:text-muted-foreground tw:text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBackdrop,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
