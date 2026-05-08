import { ArrowUpIcon } from 'lucide-react'

import { useShowOnScroll } from '@/client/hooks/use-show-on-scroll'
import { cn } from '@/ui/lib/cn'
import { btnBase, btnIcon, btnIconLg, btnLight, btnRoundedLg } from '@/ui/primitives/btn'

// Scroll-to-top button for the public site. Becomes visible only once
// the reader has moved past the initial viewport. The twin
// `AdminScrollTopButton` in the wp-admin SPA uses shadcn tokens
// instead because admin chunks don't load `public.css`; the
// scroll-position observer is shared through `useShowOnScroll` so
// both widgets stay in lockstep.
//
// `btnRoundedLg` is intentionally radius-only — `btnIcon`'s `!p-0`
// must flow through unchallenged on this icon-button consumer (see
// inner `<span>` and `<svg>` carry the centring / SVG inset utilities
// directly because the legacy `.btn-icon span` / `.btn-icon span svg`
// descendant selectors no longer match the inlined className.
export function ScrollTopButton() {
  const show = useShowOnScroll()
  // Replaces the legacy `.site-fixed-widget li.fixed-gotop { margin: 0;
  // display: none }` + `.site-fixed-widget li.fixed-gotop.current
  // { display: block }` pair: hidden by default, revealed once the
  // reader scrolls past the initial viewport. `margin: 0` is already
  // the `<li>` default via reset.css, so the inline chain only needs
  // the display toggle. The `fixed-gotop` and `current` literals stay
  // as WP-compat markers (no CSS rule of their own).
  return (
    <li className={cn('fixed-gotop', show && 'current', show ? 'block' : 'hidden')}>
      <button
        type="button"
        aria-label="回到顶部"
        className={cn(btnBase, btnLight, btnIcon, btnIconLg, btnRoundedLg)}
        onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
      >
        <span className="absolute top-0 flex size-full items-center justify-center">
          <ArrowUpIcon size="1em" aria-hidden className="m-icon-inset" />
        </span>
      </button>
    </li>
  )
}
