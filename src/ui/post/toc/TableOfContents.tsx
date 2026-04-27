import { useCallback, useState } from 'react'

import type { MarkdownHeading } from '@/server/catalog'
import type { TocOpts } from '@/shared/toc'

import config from '@/blog.config'
import { generateToC } from '@/shared/toc'
import { LeftIcon, RightIcon } from '@/ui/icons/icons'
import { TocItems } from '@/ui/post/toc/TocItems'

export interface TableOfContentsProps {
  headings: MarkdownHeading[]
  toc: boolean
}

// Toggle button base + open-state styling. Tailwind v4 needs to see every
// class as a literal string for static analysis, so the open-state classes
// live alongside the base — the parent `data-open` attribute drives them via
// `group-data-[open=true]/toc:` variants instead of a parent CSS selector.
const TOGGLE_BUTTON_CLASS = [
  // Position: floats off the right edge by default; on open it tucks into a
  // 50×50 affordance hugging the drawer.
  'fixed top-0 bottom-0 right-0 my-auto -mr-20 z-[890]',
  'flex items-center justify-start pl-[0.35rem]',
  // Surface
  'bg-toc-floating-accent text-toc-text-muted',
  'border border-toc-border-hairline rounded-full',
  'shadow-[0_0.125rem_0.3125rem_rgb(0_0_0/0.117)]',
  // Geometry (closed state). w-/h-25 = 6.25rem in this project's spacing.
  'w-25 h-25 text-[1.375rem] leading-none cursor-pointer opacity-100',
  // Transition mirrors the legacy .toggle-menu-tree ruleset: transform
  // glides at 0.5s, the rest at 0.2s.
  '[transition-property:background-color,color,transform,box-shadow]',
  '[transition-duration:0.2s,0.2s,0.5s,0.2s] [transition-timing-function:ease]',
  // Hover (closed state) — slightly larger, peeks further left.
  'hover:bg-toc-surface hover:w-30 hover:h-30 hover:rounded-[7.5rem] hover:-translate-x-5',
  // Open state (driven by parent `data-open`).
  'group-data-[open=true]/toc:bg-toc-surface group-data-[open=true]/toc:pl-0',
  'group-data-[open=true]/toc:justify-center',
  'group-data-[open=true]/toc:w-[3.125rem] group-data-[open=true]/toc:h-[3.125rem]',
  'group-data-[open=true]/toc:text-center',
  'group-data-[open=true]/toc:-mr-[1.5625rem]',
  'group-data-[open=true]/toc:-translate-x-[17.5rem]',
  'group-data-[open=true]/toc:z-[1500]',
  // Open + hover — a slightly larger affordance pinned to the same x-offset.
  'group-data-[open=true]/toc:hover:w-16 group-data-[open=true]/toc:hover:h-16',
  'group-data-[open=true]/toc:hover:rounded-[4rem]',
  'group-data-[open=true]/toc:hover:-mr-8',
  'group-data-[open=true]/toc:hover:-translate-x-[17.5rem]',
].join(' ')

const POST_MENU_CLASS = [
  'fixed top-0 bottom-0 right-[-18.125rem] z-[880]',
  'w-[17.5rem] h-full',
  'bg-toc-surface border-l border-toc-border-hairline',
  'opacity-100 font-normal',
  'transition-all duration-500 [transition-timing-function:ease]',
  // Open: slide left by exactly the drawer width.
  'group-data-[open=true]/toc:translate-x-[-18.125rem]',
  'group-data-[open=true]/toc:z-[1000]',
].join(' ')

const POST_MENU_OVERLAY_CLASS = [
  'invisible pointer-events-none',
  // Open: full-screen scrim under the drawer.
  'group-data-[open=true]/toc:visible group-data-[open=true]/toc:pointer-events-auto',
  'group-data-[open=true]/toc:fixed group-data-[open=true]/toc:inset-0',
  'group-data-[open=true]/toc:bg-toc-overlay-scrim group-data-[open=true]/toc:z-[500]',
].join(' ')

export function TableOfContents({ headings, toc }: TableOfContentsProps) {
  const generateTocConfig = toc
    ? ({
        maxHeadingLevel: config.settings.toc.maxHeadingLevel,
        minHeadingLevel: config.settings.toc.minHeadingLevel,
      } satisfies TocOpts)
    : false
  const items = generateToC(headings, generateTocConfig)
  const [visible, setVisible] = useState(false)

  // Anchor scrolling is owned by `useFocusHash` (mounted on `root.tsx`):
  // an `a[href="#section"]` click natively updates `location.hash`, which
  // `useFocusHash` observes via `useLocation()` and handles in one place.
  // The earlier global click listener here competed with that hook on
  // strict-mode double mounts and leaked when the post route unmounted.

  const onToggle = useCallback(() => setVisible((prev) => !prev), [])
  const onClose = useCallback(() => setVisible(false), [])

  if (items.length === 0) return null

  return (
    <div data-open={visible} className="contents group/toc">
      <button
        type="button"
        className={TOGGLE_BUTTON_CLASS}
        aria-label={visible ? '关闭文章目录' : '展开文章目录'}
        aria-expanded={visible}
        onClick={onToggle}
      >
        {visible ? <RightIcon className="text-md block shrink-0" /> : <LeftIcon className="text-md block shrink-0" />}
      </button>
      <div className={POST_MENU_CLASS}>
        <div className="toc-scrollbar absolute inset-y-0 left-0 -right-12 overflow-x-hidden overflow-y-auto">
          <div className="mr-12 pt-[2.875rem] transition-all duration-500 [transition-timing-function:ease]">
            <h2 className="w-full px-10 text-2xl font-bold text-left leading-[3.6rem] text-toc-title">文章目录</h2>
            <div className="pt-8">
              <TocItems items={items} />
            </div>
          </div>
        </div>
      </div>
      <div className={POST_MENU_OVERLAY_CLASS} onClick={onClose} />
    </div>
  )
}
