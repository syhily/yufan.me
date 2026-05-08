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
export function useShowOnScroll(threshold: number = 300): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let rafHandle = 0
    const update = () => {
      rafHandle = 0
      setShow(window.scrollY > threshold)
    }
    const schedule = () => {
      if (rafHandle !== 0) {
        return
      }
      rafHandle = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      if (rafHandle !== 0) {
        window.cancelAnimationFrame(rafHandle)
      }
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [threshold])

  return show
}
