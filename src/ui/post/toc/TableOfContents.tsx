import { Dialog } from '@base-ui/react/dialog'
import { useState } from 'react'

import type { MarkdownHeading } from '@/server/catalog'
import type { TocOpts } from '@/shared/toc'

import { generateToC } from '@/shared/toc'
import { LeftIcon, RightIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'
import { TocItems } from '@/ui/post/toc/TocItems'
import { useSiteConfig } from '@/ui/primitives/site-config'

export interface TableOfContentsProps {
  headings: MarkdownHeading[]
  toc: boolean
}

// Toggle button base + open-state styling. Tailwind v4 needs to see every
// class as a literal string for static analysis, so the open-state classes
// live alongside the base — Base UI sets `data-state="open"|"closed"` on
// the trigger, which drives the `data-[state=open]:` variants here.
const TOGGLE_BUTTON_CLASS = cn(
  'fixed top-0 bottom-0 right-0 my-auto -mr-20 z-(--z-drawer-handle)',
  'flex items-center justify-start pl-[0.35rem]',
  'bg-toc-floating-accent text-toc-text-muted',
  'border border-toc-border-hairline rounded-full',
  'shadow-[0_0.125rem_0.3125rem_rgb(0_0_0/0.117)]',
  'w-25 h-25 text-[1.375rem] leading-none cursor-pointer opacity-100',
  '[transition-property:background-color,color,transform,box-shadow]',
  '[transition-duration:0.2s,0.2s,0.5s,0.2s] [transition-timing-function:ease]',
  'hover:bg-toc-surface hover:w-30 hover:h-30 hover:rounded-[7.5rem] hover:-translate-x-5',
  // Open state — driven by Base UI's `data-state` attribute on the trigger.
  'data-[state=open]:bg-toc-surface data-[state=open]:pl-0',
  'data-[state=open]:justify-center',
  'data-[state=open]:w-[3.125rem] data-[state=open]:h-[3.125rem]',
  'data-[state=open]:text-center',
  'data-[state=open]:-mr-[1.5625rem]',
  'data-[state=open]:-translate-x-[17.5rem]',
  'data-[state=open]:z-(--z-drawer-handle-open)',
  'data-[state=open]:hover:w-16 data-[state=open]:hover:h-16',
  'data-[state=open]:hover:rounded-[4rem]',
  'data-[state=open]:hover:-mr-8',
  'data-[state=open]:hover:-translate-x-[17.5rem]',
)

const DRAWER_CLASS = cn(
  'fixed top-0 bottom-0 right-0 z-(--z-drawer)',
  'w-[17.5rem] h-full',
  'bg-toc-surface border-l border-toc-border-hairline',
  'opacity-100 font-normal',
  'transition-transform duration-500 [transition-timing-function:ease]',
  'translate-x-0',
  'data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
)

const SCRIM_CLASS = cn(
  'fixed inset-0 z-(--z-drawer-scrim) bg-toc-overlay-scrim',
  'transition-opacity duration-300 ease-out',
  'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
)

export function TableOfContents({ headings, toc }: TableOfContentsProps) {
  const { settings } = useSiteConfig()
  const generateTocConfig = toc
    ? ({
        maxHeadingLevel: settings.toc.maxHeadingLevel,
        minHeadingLevel: settings.toc.minHeadingLevel,
      } satisfies TocOpts)
    : false
  const items = generateToC(headings, generateTocConfig)
  const [open, setOpen] = useState(false)

  // Anchor scrolling is owned by `useFocusHash` (mounted on `root.tsx`):
  // an `a[href="#section"]` click natively updates `location.hash`, which
  // `useFocusHash` observes via `useLocation()` and handles in one place.

  if (items.length === 0) {
    return null
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            className={TOGGLE_BUTTON_CLASS}
            aria-label={open ? '关闭文章目录' : '展开文章目录'}
            aria-expanded={open}
          >
            {open ? <RightIcon className="text-md block shrink-0" /> : <LeftIcon className="text-md block shrink-0" />}
          </button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className={SCRIM_CLASS} />
        <Dialog.Popup className={DRAWER_CLASS} aria-label="文章目录">
          <div className="toc-scrollbar absolute inset-y-0 left-0 -right-12 overflow-x-hidden overflow-y-auto">
            <div className="mr-12 pt-[2.875rem] transition-all duration-500 [transition-timing-function:ease]">
              <Dialog.Title className="w-full px-10 text-2xl font-bold text-left leading-[3.6rem] text-toc-title">
                文章目录
              </Dialog.Title>
              <div className="pt-8">
                <TocItems items={items} />
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
