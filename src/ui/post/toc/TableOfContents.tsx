import { useCallback, useEffect, useState } from 'react'

import type { MarkdownHeading } from '@/server/catalog'
import type { TocOpts } from '@/shared/toc'

import config from '@/blog.config'
import { generateToC } from '@/shared/toc'
import { Icon } from '@/ui/icons/Icon'
import { TocItems } from '@/ui/post/toc/TocItems'

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
  const [visible, setVisible] = useState(false)

  // Keep the historical `body.display-menu-tree` hook for CSS that targets
  // the toggle state via the body class. It's the simplest way to avoid
  // duplicating the large block of styles from `_comments.css`.
  useEffect(() => {
    const body = document.body
    if (visible) {
      body.classList.add('display-menu-tree')
    } else {
      body.classList.remove('display-menu-tree')
    }
    return () => body.classList.remove('display-menu-tree')
  }, [visible])

  // Anchor scrolling is owned by `useFocusHash` (mounted on `root.tsx`):
  // an `a[href="#section"]` click natively updates `location.hash`, which
  // `useFocusHash` observes via `useLocation()` and handles in one place.
  // The earlier global click listener here competed with that hook on
  // strict-mode double mounts and leaked when the post route unmounted.

  const onToggle = useCallback(() => setVisible((prev) => !prev), [])

  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        className="toggle-menu-tree"
        aria-label={visible ? '关闭文章目录' : '展开文章目录'}
        aria-expanded={visible}
        onClick={onToggle}
      >
        <Icon name={visible ? 'right' : 'left'} className="text-md" />
      </button>
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
      <div className="post-menu-overlay" onClick={() => setVisible(false)} />
    </>
  )
}
