import { ArrowUpIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { cn } from '@/ui/admin/shadcn/lib/utils'

// Floating "back to top" button for the wp-admin SPA. Mirrors the public
// site's `ScrollTopButton` but is rebuilt on shadcn primitives so it
// stays Bootstrap-free (the wp-admin chunk does not load `globals.css`).
//
// Visibility is gated on `window.scrollY > 300` so the button never
// covers content above the fold. The scroll handler is rAF-throttled to
// avoid forcing a re-render on every scroll event.
export function AdminScrollTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let rafHandle = 0
    const update = () => {
      rafHandle = 0
      setShow(window.scrollY > 300)
    }
    const schedule = () => {
      if (rafHandle !== 0) return
      rafHandle = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      if (rafHandle !== 0) window.cancelAnimationFrame(rafHandle)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <Button
      type="button"
      // Match the public site's `.btn.btn-light.btn-icon.btn-rounded`
      // gotop button (see `src/ui/primitives/ScrollTopButton.tsx`):
      // light-grey pill, muted-grey arrow at rest that darkens on
      // hover, no background change. We start from `ghost` (no
      // baseline bg/text utilities) and layer the public-site colours
      // on top so the resting state lands on `--secondary` (#ededf1,
      // the admin twin of public `--btn-light` #eceef1) and the
      // hover state only swaps the foreground colour like the
      // public CSS does.
      variant="ghost"
      size="icon"
      aria-label="回到顶部"
      onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
      className={cn(
        'tw:fixed tw:right-4 tw:bottom-4 tw:lg:right-6 tw:lg:bottom-6 tw:z-40',
        // 44×44 (2.75rem) matches `.btn-icon.btn-lg`, fully rounded
        // pill, and the same drop-shadow lift the public widget uses.
        'tw:size-11 tw:rounded-full tw:shadow-lg tw:transition-all tw:duration-200',
        // Resting: light grey bg, muted-grey arrow. Hover: arrow
        // darkens to the foreground navy, bg stays put. No `bg-*`
        // hover utility on purpose.
        'tw:bg-secondary tw:text-muted-foreground tw:hover:bg-secondary tw:hover:text-foreground',
        show
          ? 'tw:opacity-100 tw:pointer-events-auto tw:translate-y-0'
          : 'tw:opacity-0 tw:pointer-events-none tw:translate-y-2',
      )}
    >
      <ArrowUpIcon className="tw:size-5" />
    </Button>
  )
}
