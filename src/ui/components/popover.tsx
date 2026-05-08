import type { ComponentProps } from 'react'

import { Popover as BasePopover } from '@base-ui/react/popover'

import { cn } from '@/ui/lib/cn'

// Popover primitive bound to `@base-ui/react`'s positioner. Mirrors
// the shadcn/ui Popover API (Trigger / Content / etc.) so the
// shadcn date-picker recipe (which composes Popover + Calendar)
// drops in unchanged. Animation hooks (`data-starting-style` /
// `data-ending-style`) come from base-ui — we only need to declare
// the open/close state classes; base-ui flips the data attributes.

function Popover({ ...props }: ComponentProps<typeof BasePopover.Root>) {
  return <BasePopover.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: ComponentProps<typeof BasePopover.Trigger>) {
  return <BasePopover.Trigger data-slot="popover-trigger" {...props} />
}

interface PopoverContentProps extends ComponentProps<typeof BasePopover.Popup> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

function PopoverContent({ className, align = 'center', sideOffset = 4, children, ...props }: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={sideOffset} align={align} className="z-(--z-modal)">
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(
            'z-(--z-modal) w-72 origin-[var(--transform-origin)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'transition-[transform,opacity] duration-150',
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

function PopoverClose({ ...props }: ComponentProps<typeof BasePopover.Close>) {
  return <BasePopover.Close data-slot="popover-close" {...props} />
}

export { Popover, PopoverClose, PopoverContent, PopoverTrigger }
