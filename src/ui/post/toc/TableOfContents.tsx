import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useCallback, useState } from 'react'

import type { MarkdownHeading } from '@/shared/catalog'
import type { TocOpts } from '@/shared/toc'

import { generateToC } from '@/shared/toc'
import { useSeoSettingsOptional } from '@/ui/lib/blog-config-context'
import { TocItems } from '@/ui/post/toc/TocItems'

// TOC toggle button. The class chain below is sliced into five
// semantic groups (layout / box / typography & colour / motion /
// state-closed / state-open) so each line owns one concern. The
// previous 50+ class single-line string was unreviewable — splitting
// keeps the diff small when (e.g.) the open-state hover sub-chain
// gets a new entry.
//
// Plain template string (NOT `cn()` / `twMerge`): the chain mixes a
// font-size custom token (`text-toc-toggle`, registered under
// `--text-*` in `tailwind.css`) with a colour custom token
// (`text-ink-secondary`, `--color-*`). Both share the `text-*`
// prefix, so `tailwind-merge` misclassifies them as conflicting and
// drops the font-size — but in CSS they target different properties
// (`font-size` vs `color`) and BOTH need to ship. A plain join
// preserves the historical class order and the rendered behaviour.
const tocToggleClass = [
  // Layout: pinned to the right edge, vertically centred, inline-flex
  // so the chevron sits on the centred baseline.
  'fixed top-0 right-0 bottom-0 z-890 my-auto -mr-20',
  'flex h-25 w-25 cursor-pointer items-center justify-start',
  // Box: 100×100 circle with a subtle 0.35rem chevron inset.
  'rounded-full border border-line bg-white/90 pl-[0.35rem]',
  // Typography & colour.
  'text-toc-toggle leading-none text-ink-secondary shadow-toc-toggle',
  // Transition: every property the state variants flip, in one go.
  'transition-[background-color,color,transform,box-shadow] duration-200',
  // State (closed) hover: grow into a 120×120 disc that pops 20px
  // closer to the viewport.
  'hover:h-30 hover:w-30 hover:-translate-x-5 hover:bg-surface',
  // State (open): collapse into a smaller pill anchored to the open
  // drawer's edge, recentre the chevron, and slide left into view.
  'data-[state=open]:z-1500 data-[state=open]:-mr-6.25 data-[state=open]:h-12.5 data-[state=open]:w-12.5 data-[state=open]:-translate-x-70 data-[state=open]:justify-center data-[state=open]:bg-surface data-[state=open]:pl-0',
  // State (open) hover: same idea as the closed-hover step but
  // larger and slightly off the right edge.
  'data-[state=open]:hover:-mr-8 data-[state=open]:hover:h-16 data-[state=open]:hover:w-16 data-[state=open]:hover:-translate-x-70',
].join(' ')

// TOC drawer. Layout (fixed sticky rail) + box (240px wide, full
// viewport height, left-edge divider) + colour (surface fill) +
// state (slide-in on open). Same plain-join rationale as the toggle.
const tocDrawerClass = [
  'fixed top-0 -right-72.5 bottom-0 z-880 h-full w-70 border-l border-line bg-surface font-normal transition-transform duration-500 ease-in-out',
  'data-[state=open]:z-1000 data-[state=open]:-translate-x-72.5',
].join(' ')

// Scrim behind the drawer. Hidden until `data-state=open` and only
// then occupies the viewport.
const tocBackdropClass = [
  'pointer-events-none invisible',
  'data-[state=open]:pointer-events-auto data-[state=open]:visible data-[state=open]:fixed data-[state=open]:inset-0 data-[state=open]:z-500 data-[state=open]:bg-black/30',
].join(' ')

const DEFAULT_TOC_CONFIG = {
  maxHeadingLevel: 4,
  minHeadingLevel: 2,
} satisfies TocOpts

export interface TableOfContentsProps {
  headings: MarkdownHeading[]
  toc: boolean
}

// `<TableOfContents>` only mounts inside public detail routes that are
// wrapped by `<BlogSettingsProvider>` (live SSR + client + the feed
// prerender). The optional hook returns `undefined` only on a
// pre-install render — outside the install split-screen, that path
// is intercepted by the install gate before this component mounts —
// in which case we fall back to the project's historical 2..4 heading
// levels.
export function TableOfContents({ headings, toc }: TableOfContentsProps) {
  const seo = useSeoSettingsOptional()
  const generateTocConfig = toc ? (seo?.toc ?? DEFAULT_TOC_CONFIG) : false
  const items = generateToC(headings, generateTocConfig)
  const [visible, setVisible] = useState(false)

  // Anchor scrolling is owned by `useFocusHash` (mounted on `root.tsx`):
  // an `a[href="#section"]` click natively updates `location.hash`, which
  // `useFocusHash` observes via `useLocation()` and handles in one place.
  // The earlier global click listener here competed with that hook on
  // strict-mode double mounts and leaked when the post route unmounted.

  const onToggle = useCallback(() => setVisible((prev) => !prev), [])

  if (items.length === 0) {
    return null
  }

  const state = visible ? 'open' : 'closed'

  return (
    <>
      <button
        type="button"
        data-state={state}
        className={tocToggleClass}
        aria-label={visible ? '关闭文章目录' : '展开文章目录'}
        aria-expanded={visible}
        onClick={onToggle}
      >
        {visible ? (
          <ChevronRightIcon className="text-md" size="1em" aria-hidden />
        ) : (
          <ChevronLeftIcon className="text-md" size="1em" aria-hidden />
        )}
      </button>
      <div data-state={state} className={tocDrawerClass}>
        <div className="absolute top-0 -right-12 bottom-0 left-0 overflow-x-hidden overflow-y-auto">
          <div className="mr-12 pt-11.5">
            <h2 className="w-full px-10 text-left text-toc-title leading-[3.6rem] font-bold text-ink-strong">
              文章目录
            </h2>
            <div className="pt-8">
              <TocItems items={items} />
            </div>
          </div>
        </div>
      </div>
      <div data-state={state} className={tocBackdropClass} onClick={() => setVisible(false)} />
    </>
  )
}
