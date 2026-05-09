import type { RefObject } from 'react'

import { useEffect, useState } from 'react'

// Shared scroll-position observer for floating "back to top" buttons
// and similar chrome that needs to appear/disappear based on how far
// the user has scrolled. Uses rAF to coalesce scroll events so we
// only `setState` at most once per animation frame.
//
// Consumers live under `src/ui/`: the public site's
// `ScrollTopButton` (Bootstrap-styled) and the wp-admin SPA's
// `AdminScrollTopButton` (shadcn-styled) both subscribe to this
// hook so their visibility thresholds stay lockstep.
//
// When `scrollRootRef` is set (wp-admin `<main>`), scroll depth is read
// from that element instead of `window` so the button still works after
// the shell pins the document to the viewport and scrolls inside `main`.
export function useShowOnScroll(threshold: number = 300, scrollRootRef?: RefObject<Element | null>): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let rafHandle = 0
    const update = () => {
      rafHandle = 0
      const root = scrollRootRef?.current ?? null
      const top = root !== null ? root.scrollTop : window.scrollY
      setShow(top > threshold)
    }
    const schedule = () => {
      if (rafHandle !== 0) {
        return
      }
      rafHandle = window.requestAnimationFrame(update)
    }
    const root = scrollRootRef?.current ?? null
    const scrollTarget: Window | Element = root ?? window
    scrollTarget.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      if (rafHandle !== 0) {
        window.cancelAnimationFrame(rafHandle)
      }
      scrollTarget.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [threshold, scrollRootRef])

  return show
}
