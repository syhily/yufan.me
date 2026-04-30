import type { ComponentProps } from 'react'

import { Tabs as BaseTabs } from '@base-ui/react/tabs'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Tabs({ className, ...props }: ComponentProps<typeof BaseTabs.Root>) {
  return <BaseTabs.Root data-slot="tabs" className={cn('tw:flex tw:flex-col tw:gap-2', className)} {...props} />
}

function TabsList({ className, ...props }: ComponentProps<typeof BaseTabs.List>) {
  // Render the track as a hairline-bordered surface with explicit gaps
  // between tabs. The default shadcn track uses `bg-muted` (oklch ≈ 0.97)
  // against a white card, which makes it nearly invisible and collapses
  // the three tabs into one shape. A subtle border + per-tab gap makes
  // the segmented control unambiguously read as multiple buttons even
  // when only one is selected.
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      className={cn(
        'tw:bg-muted/60 tw:text-muted-foreground tw:inline-flex tw:h-9 tw:w-fit tw:items-center tw:justify-center tw:gap-1 tw:rounded-lg tw:border tw:p-[3px]',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  // Selected tab: solid `bg-background` (white) + visible border + shadow
  // so it pops above the track. Unselected tabs stay text-only with a
  // hover affordance, which preserves the segmented-control affordance
  // on light backgrounds where `bg-muted` and `bg-background` are close.
  return (
    <BaseTabs.Tab
      data-slot="tabs-trigger"
      className={cn(
        'tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:outline-ring tw:text-muted-foreground tw:hover:text-foreground tw:data-[selected]:text-foreground tw:data-[selected]:bg-background tw:data-[selected]:border-border tw:data-[selected]:shadow-sm tw:dark:data-[selected]:border-input tw:dark:data-[selected]:bg-input/30 tw:dark:text-muted-foreground tw:dark:data-[selected]:text-foreground tw:inline-flex tw:h-[calc(100%-1px)] tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-md tw:border tw:border-transparent tw:px-3 tw:py-1 tw:text-sm tw:font-medium tw:whitespace-nowrap tw:transition-[color,background-color,box-shadow] tw:focus-visible:ring-[3px] tw:focus-visible:outline-1 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel data-slot="tabs-content" className={cn('tw:flex-1 tw:outline-none', className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
