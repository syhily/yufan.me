import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { MarkdownHeading } from '@/shared/catalog'
import type { TocOpts } from '@/shared/toc'

import { generateToC } from '@/shared/toc'
import { useSeoSettingsOptional } from '@/ui/lib/blog-config-context'
import { TocItems } from '@/ui/post/toc/TocItems'

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

  // Keep the historical `body.display-menu-tree` hook for CSS that targets
  // the toggle state via the body class. The ToC overlay's chrome lives in
  // `@/ui/post/toc/toc.css` and reads this class to flip the drawer
  // (`.display-menu-tree .post-menu` translateX, `.display-menu-tree
  // .toggle-menu-tree` shape change, `.display-menu-tree .post-menu-overlay`
  // visibility); driving the toggle through a body class instead of a
  // React `data-state` keeps the CSS hook the same one this project has
  // shipped since the legacy build.
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

  if (items.length === 0) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className="toggle-menu-tree"
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
