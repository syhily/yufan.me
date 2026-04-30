import type { ComponentProps } from 'react'

import { Menu as BaseMenu } from '@base-ui/react/menu'
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function DropdownMenu({ ...props }: ComponentProps<typeof BaseMenu.Root>) {
  return <BaseMenu.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: ComponentProps<typeof BaseMenu.Portal>) {
  return <BaseMenu.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: ComponentProps<typeof BaseMenu.Trigger>) {
  return <BaseMenu.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'start',
  ...props
}: ComponentProps<typeof BaseMenu.Popup> & {
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <DropdownMenuPortal>
      <BaseMenu.Positioner sideOffset={sideOffset} align={align} className="tw:z-50">
        <BaseMenu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'tw:bg-popover tw:text-popover-foreground tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:z-50 tw:max-h-[var(--available-height)] tw:min-w-[8rem] tw:origin-[var(--transform-origin)] tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-md tw:border tw:p-1 tw:shadow-md',
            className,
          )}
          {...props}
        />
      </BaseMenu.Positioner>
    </DropdownMenuPortal>
  )
}

function DropdownMenuGroup({ ...props }: ComponentProps<typeof BaseMenu.Group>) {
  return <BaseMenu.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: ComponentProps<typeof BaseMenu.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <BaseMenu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[variant=destructive]:text-destructive tw:data-[variant=destructive]:focus:bg-destructive/10 tw:dark:data-[variant=destructive]:focus:bg-destructive/20 tw:data-[variant=destructive]:focus:text-destructive tw:data-[variant=destructive]:*:[svg]:!text-destructive tw:data-[highlighted]:bg-accent tw:data-[highlighted]:text-accent-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-[inset]:pl-8 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof BaseMenu.CheckboxItem>) {
  return (
    <BaseMenu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'tw:focus:bg-accent tw:focus:text-accent-foreground tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-2 tw:pl-8 tw:text-sm tw:outline-hidden tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    >
      <span className="tw:pointer-events-none tw:absolute tw:left-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center">
        <BaseMenu.CheckboxItemIndicator>
          <CheckIcon className="tw:size-4" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: ComponentProps<typeof BaseMenu.RadioGroup>) {
  return <BaseMenu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof BaseMenu.RadioItem>) {
  return (
    <BaseMenu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'tw:focus:bg-accent tw:focus:text-accent-foreground tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-2 tw:pl-8 tw:text-sm tw:outline-hidden tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    >
      <span className="tw:pointer-events-none tw:absolute tw:left-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center">
        <BaseMenu.RadioItemIndicator>
          <CircleIcon className="tw:size-2 tw:fill-current" />
        </BaseMenu.RadioItemIndicator>
      </span>
      {children}
    </BaseMenu.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof BaseMenu.GroupLabel> & { inset?: boolean }) {
  return (
    <BaseMenu.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn('tw:px-2 tw:py-1.5 tw:text-sm tw:font-medium tw:data-[inset]:pl-8', className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof BaseMenu.Separator>) {
  return (
    <BaseMenu.Separator
      data-slot="dropdown-menu-separator"
      className={cn('tw:bg-border tw:-mx-1 tw:my-1 tw:h-px', className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('tw:text-muted-foreground tw:ml-auto tw:text-xs tw:tracking-widest', className)}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: ComponentProps<typeof BaseMenu.SubmenuRoot>) {
  return <BaseMenu.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.SubmenuTrigger> & { inset?: boolean }) {
  return (
    <BaseMenu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[popup-open]:bg-accent tw:data-[popup-open]:text-accent-foreground tw:flex tw:cursor-default tw:items-center tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[inset]:pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="tw:ml-auto tw:size-4" />
    </BaseMenu.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof BaseMenu.Popup>) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner className="tw:z-50">
        <BaseMenu.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            'tw:bg-popover tw:text-popover-foreground tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:z-50 tw:min-w-[8rem] tw:origin-[var(--transform-origin)] tw:overflow-hidden tw:rounded-md tw:border tw:p-1 tw:shadow-lg',
            className,
          )}
          {...props}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
