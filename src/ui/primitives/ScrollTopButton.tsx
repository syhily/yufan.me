import { useEffect, useState } from 'react'

import { ArrowUpIcon } from '@/ui/icons/icons'
import { Button } from '@/ui/primitives/Button'

// Scroll-to-top button. Becomes visible only once the reader has moved past
// the initial viewport. Uses an `IntersectionObserver` against a top-of-document
// sentinel instead of a passive scroll listener: the observer fires twice
// (entering / leaving the viewport) instead of once per scroll frame, which
// keeps the main thread free during long-form reading.
//
// The sentinel is appended to `document.body` from the effect because the
// component renders a fixed-positioned wrapper at the bottom-right of the
// viewport — adding the sentinel as a JSX sibling here would anchor it to
// the wrapper's containing block, not the document.
//
// The component owns its semantic shell (`<ul><li>`) so callers don't have
// to wrap it in a parent list — a bare `<li>` floating in the page tree
// is a semantic violation a parent shouldn't be forced to fix.
export function ScrollTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;'
    document.body.appendChild(sentinel)

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) {
          return
        }
        // Inverse of intersection: button shows whenever the sentinel has
        // scrolled past the rootMargin band at the top of the viewport.
        setShow(!entry.isIntersecting)
      },
      { rootMargin: '300px 0px 0px 0px' },
    )
    io.observe(sentinel)

    return () => {
      io.disconnect()
      sentinel.remove()
    }
  }, [])

  return (
    <ul className="fixed right-5 bottom-0 block -translate-y-1/2 z-(--z-fab)">
      <li className={`m-0 ${show ? 'block' : 'hidden'}`}>
        <Button.Icon
          tone="neutral"
          size="lg"
          aria-label="回到顶部"
          onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
        >
          <span>
            <ArrowUpIcon />
          </span>
        </Button.Icon>
      </li>
    </ul>
  )
}
