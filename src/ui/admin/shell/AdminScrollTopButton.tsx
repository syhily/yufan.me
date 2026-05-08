import { ArrowUpIcon } from 'lucide-react'

import { useShowOnScroll } from '@/client/hooks/use-show-on-scroll'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/cn'

// Floating "back to top" button for the wp-admin SPA. Mirrors the public
// site's `ScrollTopButton` but is rebuilt on shadcn primitives so it
// stays Bootstrap-free (the wp-admin chunk does not load `public.css`).
//
// Visibility is gated on `window.scrollY > 300` via the shared
// `useShowOnScroll` hook so both the public and admin widgets stay
// lockstep on identical scroll thresholds and rAF throttling.
export function AdminScrollTopButton() {
  const show = useShowOnScroll()

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
        'fixed right-4 bottom-4 z-40 lg:right-6 lg:bottom-6',
        // 44×44 (2.75rem) matches `.btn-icon.btn-lg`, fully rounded
        // pill, and the same drop-shadow lift the public widget uses.
        'size-11 rounded-full shadow-lg transition-all duration-200',
        // Resting: light grey bg, muted-grey arrow. Hover: arrow
        // darkens to the foreground navy, bg stays put. No `bg-*`
        // hover utility on purpose.
        'bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground',
        show ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <ArrowUpIcon data-icon="lg" />
    </Button>
  )
}
