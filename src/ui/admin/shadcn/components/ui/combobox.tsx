import type { ComponentProps } from 'react'

import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'

import { cn } from '@/ui/admin/shadcn/lib/utils'

// shadcn-style wrapper around Base UI's `Combobox` primitive. The visual
// language mirrors `select.tsx` (same trigger / popup / item shapes) but
// the popup is a *searchable* listbox: a `Combobox.Input` lives inside
// the popup, and Base UI handles substring filtering against the `items`
// prop on `Combobox.Root`.
//
// Use this when a Select would otherwise have many entries and the user
// would benefit from typing to filter. For short, fixed lists prefer
// `select.tsx` so the keyboard interaction stays a plain dropdown.

function Combobox<Value>(props: ComponentProps<typeof BaseCombobox.Root<Value, false>>) {
  return <BaseCombobox.Root data-slot="combobox" {...props} />
}

function ComboboxValue({ ...props }: ComponentProps<typeof BaseCombobox.Value>) {
  return <BaseCombobox.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  className,
  size = 'default',
  children,
  ...props
}: ComponentProps<typeof BaseCombobox.Trigger> & { size?: 'sm' | 'default' }) {
  return (
    <BaseCombobox.Trigger
      data-slot="combobox-trigger"
      data-size={size}
      className={cn(
        "tw:border-input tw:data-[popup-open]:border-ring tw:data-[popup-open]:ring-ring/50 tw:data-[popup-open]:ring-[3px] tw:dark:bg-input/30 tw:dark:hover:bg-input/50 tw:flex tw:w-fit tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:bg-transparent tw:px-3 tw:py-2 tw:text-sm tw:whitespace-nowrap tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px] tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[size=default]:h-9 tw:data-[size=sm]:h-8 tw:*:data-[slot=combobox-value]:line-clamp-1 tw:*:data-[slot=combobox-value]:flex tw:*:data-[slot=combobox-value]:items-center tw:*:data-[slot=combobox-value]:gap-2 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4 tw:[&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <BaseCombobox.Icon>
        <ChevronDownIcon className="tw:size-4 tw:opacity-50" />
      </BaseCombobox.Icon>
    </BaseCombobox.Trigger>
  )
}

interface ComboboxContentProps<Item = unknown> extends Omit<ComponentProps<typeof BaseCombobox.Popup>, 'children'> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  inputPlaceholder?: string
  emptyMessage?: string
  // Render prop matching `Combobox.List`'s function-child contract: when
  // `Combobox.Root` receives an `items` prop, the list iterates over the
  // *filtered* subset and invokes this for each matching entry. The
  // `Item` generic is best supplied by the caller (e.g. `<ComboboxContent<Page>>`)
  // so the render closure stays type-safe per call site.
  children: (item: Item, index: number) => React.ReactNode
}

function ComboboxContent<Item>({
  className,
  children,
  align = 'start',
  sideOffset,
  inputPlaceholder = '搜索…',
  emptyMessage = '无匹配结果',
  ...props
}: ComboboxContentProps<Item>) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner align={align} sideOffset={sideOffset ?? 4} className="tw:z-50">
        <BaseCombobox.Popup
          data-slot="combobox-content"
          className={cn(
            'tw:bg-popover tw:text-popover-foreground tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:relative tw:z-50 tw:flex tw:max-h-[var(--available-height)] tw:min-w-[var(--anchor-width)] tw:origin-[var(--transform-origin)] tw:flex-col tw:overflow-hidden tw:rounded-md tw:border tw:shadow-md',
            className,
          )}
          {...props}
        >
          <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:px-3 tw:py-2">
            <SearchIcon className="tw:text-muted-foreground tw:size-4 tw:shrink-0" />
            <BaseCombobox.Input
              placeholder={inputPlaceholder}
              className="tw:placeholder:text-muted-foreground tw:flex-1 tw:bg-transparent tw:text-sm tw:outline-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
            />
          </div>
          {/*
           * Base UI's `Combobox.Empty` must stay mounted in the DOM
           * regardless of result state — it doubles as an `aria-live`
           * region for AT users (see ComboboxEmpty.js docstring), so we
           * cannot conditionally render it or hide it with `hidden` /
           * `display:none`. To stop it from reserving its `py-6` worth
           * of vertical space when the list has matches, scope the
           * padding/border behind the `empty:` Tailwind variant — the
           * div is genuinely empty whenever Base UI hands it `null`
           * children (i.e. `filteredItems.length > 0`).
           */}
          <BaseCombobox.Empty className="tw:text-muted-foreground tw:text-center tw:text-sm tw:not-empty:px-3 tw:not-empty:py-6">
            {emptyMessage}
          </BaseCombobox.Empty>
          <BaseCombobox.List className="tw:flex tw:max-h-[min(var(--available-height),20rem)] tw:flex-col tw:gap-0.5 tw:overflow-y-auto tw:p-1">
            {children}
          </BaseCombobox.List>
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

function ComboboxItem({ className, children, ...props }: ComponentProps<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item
      data-slot="combobox-item"
      className={cn(
        "tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[highlighted]:bg-accent tw:data-[highlighted]:text-accent-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:w-full tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-8 tw:pl-2 tw:text-sm tw:outline-hidden tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <span className="tw:absolute tw:right-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center">
        <BaseCombobox.ItemIndicator>
          <CheckIcon className="tw:size-4" />
        </BaseCombobox.ItemIndicator>
      </span>
    </BaseCombobox.Item>
  )
}

export { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue }
