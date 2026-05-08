import { memo } from 'react'

import type { TocItem } from '@/shared/toc'

export interface TocItemsProps {
  items: TocItem[]
}

// `TocItems` recurses through every heading on a long post; on hydration and
// every subsequent re-render (e.g. `useLocation` changes for nav highlight)
// React would re-walk the whole tree even though the headings array is
// loader-stable. Wrapping in `React.memo` with reference equality short-
// circuits the tree at the root unless the headings actually change.
function TocItemsImpl({ items }: TocItemsProps) {
  return (
    <ul className="index-menu-list">
      {items.map((item) => (
        <li key={item.slug} className="index-menu-item">
          <a data-scroll className="index-menu-link" href={`#${item.slug}`} title={item.text}>
            <span className="menu-content">{item.text}</span>
          </a>
          {item.children.length > 0 && <TocItems items={item.children} />}
        </li>
      ))}
    </ul>
  )
}

export const TocItems = memo(TocItemsImpl)
