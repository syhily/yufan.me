import type { ComponentProps } from 'react'

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function TooltipProvider({ delay = 0, ...props }: ComponentProps<typeof BaseTooltip.Provider>) {
  return <BaseTooltip.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip({ ...props }: ComponentProps<typeof BaseTooltip.Root>) {
  return (
    <TooltipProvider>
      <BaseTooltip.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({ ...props }: ComponentProps<typeof BaseTooltip.Trigger>) {
  return <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: ComponentProps<typeof BaseTooltip.Popup> & { sideOffset?: number }) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} className="tw:z-50">
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            'tw:bg-primary tw:text-primary-foreground tw:data-[ending-style]:opacity-0 tw:data-[ending-style]:scale-95 tw:data-[starting-style]:opacity-0 tw:data-[starting-style]:scale-95 tw:z-50 tw:w-fit tw:origin-[var(--transform-origin)] tw:rounded-md tw:px-3 tw:py-1.5 tw:text-xs tw:text-balance',
            className,
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
