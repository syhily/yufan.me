import { ArrowUpIcon } from 'lucide-react'

import { useShowOnScroll } from '@/client/hooks/use-show-on-scroll'
import { cn } from '@/ui/lib/cn'
import { publicButtonVariants } from '@/ui/primitives/btn'
import { IconButtonContent } from '@/ui/primitives/IconButtonContent'

// Scroll-to-top button for the public site. Becomes visible only once
// the reader has moved past the initial viewport. The twin
// `AdminScrollTopButton` in the wp-admin SPA uses shadcn tokens
// instead because admin chunks don't load `public.css`; the
// scroll-position observer is shared through `useShowOnScroll` so
// both widgets stay in lockstep.
//
// `shape: 'pill'` is intentionally radius-only — `size: 'iconLg'` pins
// the square padding to zero on this icon-button consumer (see
// inner `<span>` and `<svg>` carry the centring / SVG inset utilities
// directly because the legacy `.btn-icon span` / `.btn-icon span svg`
// descendant selectors no longer match the inlined className.
//
// Mobile rendering ghost (iOS Safari + Chromium-on-iOS, 100%
// reproducible during inertial scroll / URL-bar collapse):
//
//   The original implementation toggled visibility with `display:
//   block` ↔ `display: hidden`. Mobile compositors snapshot
//   `position: fixed` descendants into a separate layer for
//   scroll-time compositing; abrupt `display` swaps invalidate the
//   layer's box geometry mid-frame, so the previous bitmap lingers
//   as a "ghost" until the next paint flush — exactly what the user
//   reported. The fix is two parts working together:
//
//     1. Toggle visibility with `opacity` + `pointer-events` (and
//        `aria-hidden` / `tabIndex={-1}` for SR + keyboard parity)
//        instead of `display`. The box geometry stays stable across
//        the toggle, so the compositor keeps the same tile and just
//        re-blends opacity (which is GPU-accelerated and ghost-free).
//     2. Promote the host `<li>` to its own compositor layer with
//        `transform: translateZ(0)`. This guarantees iOS Safari
//        keeps the button on the GPU compositor (same path the URL
//        bar uses) so `opacity` transitions never fall back to the
//        CPU paint pipeline mid-scroll.
//
//   `transition-opacity` rides at the default 150ms so the show /
//   hide flips read as a smooth fade rather than a hard cut, which
//   also masks any single-frame compositor lag on slower devices.
export function ScrollTopButton() {
  const show = useShowOnScroll()
  return (
    <li
      aria-hidden={!show}
      className={cn(
        // GPU-layer promotion (see "Mobile rendering ghost" above).
        // `transform-gpu` emits `transform: translateZ(0) …` which
        // forces the host onto the compositor's GPU layer.
        'transform-gpu',
        'transition-opacity duration-150 ease-out',
        show ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <button
        type="button"
        aria-label="回到顶部"
        // When hidden, take the trigger out of the keyboard tab order
        // too — `pointer-events-none` only blocks pointer input.
        tabIndex={show ? 0 : -1}
        className={publicButtonVariants({ variant: 'light', size: 'iconLg', shape: 'pill' })}
        onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
      >
        <IconButtonContent>
          <ArrowUpIcon size="1em" aria-hidden className="m-icon-inset" />
        </IconButtonContent>
      </button>
    </li>
  )
}
