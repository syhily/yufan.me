import type { ComponentProps } from 'react'

import { Select as BaseSelect } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Select<Value>(props: ComponentProps<typeof BaseSelect.Root<Value>>) {
  return <BaseSelect.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: ComponentProps<typeof BaseSelect.Group>) {
  return <BaseSelect.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: ComponentProps<typeof BaseSelect.Value>) {
  return <BaseSelect.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: ComponentProps<typeof BaseSelect.Trigger> & { size?: 'sm' | 'default' }) {
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "tw:border-input tw:data-[popup-open]:border-ring tw:data-[popup-open]:ring-ring/50 tw:data-[popup-open]:ring-[3px] tw:dark:bg-input/30 tw:dark:hover:bg-input/50 tw:flex tw:w-fit tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:bg-transparent tw:px-3 tw:py-2 tw:text-sm tw:whitespace-nowrap tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px] tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[size=default]:h-9 tw:data-[size=sm]:h-8 tw:*:data-[slot=select-value]:line-clamp-1 tw:*:data-[slot=select-value]:flex tw:*:data-[slot=select-value]:items-center tw:*:data-[slot=select-value]:gap-2 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4 tw:[&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDownIcon className="tw:size-4 tw:opacity-50" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

function SelectContent({
  className,
  children,
  align = 'start',
  sideOffset,
  ...props
}: ComponentProps<typeof BaseSelect.Popup> & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) {
  return (
    <BaseSelect.Portal>
      {/*
       * `alignItemWithTrigger={false}` switches Base UI's Select away
       * from its native macOS-style behaviour where the popup overlays
       * the trigger and the selected item lines up over the trigger
       * label. That mode is disorienting in our admin form context —
       * the popup appears to "swallow" the trigger and the chevron
       * disappears under the popup border, which the user reported as
       * "下拉框样式很奇怪". With it disabled the popup behaves like a
       * standard shadcn/Radix popper: anchored below the trigger with
       * a 4px gap, so the trigger and its chevron stay fully visible.
       *
       * `min-w-[var(--anchor-width)]` matches the popup width to the
       * trigger so options never look narrower than their parent
       * combobox column. The CSS variable is exposed by Base UI's
       * positioner.
       */}
      <BaseSelect.Positioner
        align={align}
        side="bottom"
        sideOffset={sideOffset ?? 4}
        alignItemWithTrigger={false}
        className="tw:z-50"
      >
        <BaseSelect.ScrollUpArrow className="tw:flex tw:cursor-default tw:items-center tw:justify-center tw:py-1">
          <ChevronUpIcon className="tw:size-4" />
        </BaseSelect.ScrollUpArrow>
        <BaseSelect.Popup
          data-slot="select-content"
          className={cn(
            'tw:bg-popover tw:text-popover-foreground tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:relative tw:z-50 tw:max-h-[var(--available-height)] tw:min-w-[max(8rem,var(--anchor-width))] tw:origin-[var(--transform-origin)] tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-md tw:border tw:p-1 tw:shadow-md',
            className,
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
        <BaseSelect.ScrollDownArrow className="tw:flex tw:cursor-default tw:items-center tw:justify-center tw:py-1">
          <ChevronDownIcon className="tw:size-4" />
        </BaseSelect.ScrollDownArrow>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

function SelectLabel({ className, ...props }: ComponentProps<typeof BaseSelect.GroupLabel>) {
  return (
    <BaseSelect.GroupLabel
      data-slot="select-label"
      className={cn('tw:text-muted-foreground tw:px-2 tw:py-1.5 tw:text-xs', className)}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      data-slot="select-item"
      className={cn(
        "tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[highlighted]:bg-accent tw:data-[highlighted]:text-accent-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:w-full tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-8 tw:pl-2 tw:text-sm tw:outline-hidden tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4 tw:*:[span]:last:flex tw:*:[span]:last:items-center tw:*:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="tw:absolute tw:right-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center">
        <BaseSelect.ItemIndicator>
          <CheckIcon className="tw:size-4" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

function SelectSeparator({ className, ...props }: ComponentProps<typeof BaseSelect.Separator>) {
  return (
    <BaseSelect.Separator
      data-slot="select-separator"
      className={cn('tw:bg-border tw:pointer-events-none tw:-mx-1 tw:my-1 tw:h-px', className)}
      {...props}
    />
  )
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue }
