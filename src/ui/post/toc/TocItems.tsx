import { memo } from 'react'

import type { TocItem } from '@/shared/toc'

export interface TocItemsProps {
  items: TocItem[]
  /**
   * Internal recursion depth. The top-level call leaves it `undefined` so the
   * default styling kicks in; nested calls bump it up to drive the per-level
   * indent on the inner `<span>`.
   */
  depth?: number
}

const LINK_CLASS = [
  'block relative px-10 py-1.5',
  'text-toc-text-muted text-[0.85rem]',
  'whitespace-nowrap overflow-hidden text-ellipsis',
  'hover:bg-toc-link-hover-bg hover:text-toc-link-hover-text',
].join(' ')

// Indent table mirrors the legacy `.index-menu-item > .index-menu-list ...`
// nested cascade: depth 0 is flush, depth 1 indents 2rem, depth 2+ indents 4rem.
const INDENTS: Record<number, string> = {
  0: '',
  1: 'pl-8',
  2: 'pl-16',
}

// `TocItems` recurses through every heading on a long post; on hydration and
// every subsequent re-render (e.g. `useLocation` changes for nav highlight)
// React would re-walk the whole tree even though the headings array is
// loader-stable. Wrapping in `React.memo` with reference equality short-
// circuits the tree at the root unless the headings actually change.
function TocItemsImpl({ items, depth = 0 }: TocItemsProps) {
  const contentIndent = INDENTS[depth] ?? INDENTS[2]

  return (
    <ul className="leading-[1.8em] list-none p-0">
      {items.map((item) => (
        <li key={item.slug} className="overflow-hidden text-ellipsis">
          <a data-scroll className={LINK_CLASS} href={`#${item.slug}`} title={item.text}>
            <span className={contentIndent}>{item.text}</span>
          </a>
          {item.children.length > 0 && <TocItems items={item.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

export const TocItems = memo(TocItemsImpl)
