import { memo } from 'react'

import type { TocItem } from '@/shared/toc'

export interface TocItemsProps {
  items: TocItem[]
  depth?: number
}

// `TocItems` recurses through every heading on a long post; on hydration and
// every subsequent re-render (e.g. `useLocation` changes for nav highlight)
// React would re-walk the whole tree even though the headings array is
// loader-stable. Wrapping in `React.memo` with reference equality short-
// circuits the tree at the root unless the headings actually change.
//
// `depth` drives the per-level indentation of `.menu-content`. The legacy
// CSS used descendant selectors to apply `padding-left: 2rem` at depth 1
// and `4rem` at depth 2 (deeper levels were never styled). Threading the
// depth through the recursion makes the indent class statically present in
// the source — it satisfies `bundle-analyzable-paths` and lets Tailwind
// pick the literal `pl-*` classes up at build time.
const MENU_CONTENT_INDENT = ['', 'pl-8', 'pl-16'] as const

function TocItemsImpl({ items, depth = 0 }: TocItemsProps) {
  const indent = MENU_CONTENT_INDENT[Math.min(depth, MENU_CONTENT_INDENT.length - 1)]
  return (
    <ul className="list-none p-0 leading-[1.8em]">
      {items.map((item) => (
        <li key={item.slug} className="overflow-hidden text-ellipsis">
          <a
            data-scroll
            className="relative block overflow-hidden px-10 py-1.5 text-toc-link text-ellipsis whitespace-nowrap text-ink-secondary hover:bg-surface-dim hover:text-ink-strong"
            href={`#${item.slug}`}
            title={item.text}
          >
            <span className={indent}>{item.text}</span>
          </a>
          {item.children.length > 0 && <TocItems items={item.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

export const TocItems = memo(TocItemsImpl)
