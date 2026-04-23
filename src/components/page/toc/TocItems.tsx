import type { TocItem } from '@/services/markdown/toc'

export interface TocItemsProps {
  items: TocItem[]
}

export function TocItems({ items }: TocItemsProps) {
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
