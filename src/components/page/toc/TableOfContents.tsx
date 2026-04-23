import type { MarkdownHeading } from '@/services/catalog'
import type { TocOpts } from '@/services/markdown/toc'

import { Icon } from '@/assets/icons/Icon'
import config from '@/blog.config'
import { TocItems } from '@/components/page/toc/TocItems'
import { generateToC } from '@/services/markdown/toc'

export interface TableOfContentsProps {
  headings: MarkdownHeading[]
  toc: boolean
}

export function TableOfContents({ headings, toc }: TableOfContentsProps) {
  const generateTocConfig = toc
    ? ({
        maxHeadingLevel: config.settings.toc.maxHeadingLevel,
        minHeadingLevel: config.settings.toc.minHeadingLevel,
      } satisfies TocOpts)
    : false
  const items = generateToC(headings, generateTocConfig)
  if (items.length === 0) return null

  return (
    <>
      <a className="toggle-menu-tree">
        <Icon name="left" className="text-md" />
      </a>
      <div className="post-menu">
        <div className="toc-wrap">
          <div className="toc-content">
            <h2 className="post-menu-title">文章目录</h2>
            <div className="index-menu">
              <TocItems items={items} />
            </div>
          </div>
        </div>
      </div>
      <div className="post-menu-overlay" />
    </>
  )
}
