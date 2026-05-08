import { Moon, Sun } from 'lucide-react'

import { Button } from '@/ui/components/button'
import { IconButtonContent } from '@/ui/components/icon-button-content'
import { useTheme } from '@/ui/lib/ThemeProvider'

interface ThemeToggleProps {
  mode: 'public' | 'admin'
  // `'rail'` (default) renders the small dark circle used inside the
  // Header's social rail. `'floating'` matches `ScrollTopButton`'s
  // light pill so the mobile-only widget pair (theme above scroll-top)
  // reads as a single visual unit.
  variant?: 'rail' | 'floating'
}

// Light mode shows the Moon (jump-target = dark) and dark mode shows
// the Sun (jump-target = light) so the visible glyph always describes
// the action the click performs. Both icons sit in the DOM and the
// `dark:` Tailwind variant swaps them via opacity + scale, so noscript
// visitors on a dark-OS preference get the correct icon even before
// any client JS runs (the `dark` custom-variant in `tailwind.css`
// fires under `prefers-color-scheme: dark` when no class is set).
// Moon is the in-flow icon (centred by `IconButtonContent`'s flex);
// Sun overlays absolutely against the same wrapper so both glyphs
// share one centre point regardless of which is currently scaled in.
// The overlay deliberately omits `m-icon-inset` — combining margin:28%
// with `absolute inset-0` over-constrains the box and the browser keeps
// top/left margins while dropping bottom/right, shifting the Sun toward
// the bottom-right. `inset-0 m-auto` alone centres the intrinsic 1em SVG.
const moonClass = 'm-icon-inset transition-all dark:scale-0 dark:opacity-0'
const sunClass = 'absolute inset-0 m-auto scale-0 opacity-0 transition-all dark:scale-100 dark:opacity-100'

export function ThemeToggle({ mode, variant = 'rail' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  if (mode === 'public') {
    // Two sr-only labels live in the DOM so noscript / pre-hydration
    // visitors get the correct accessible name from the CSS swap, not
    // from the client-resolved `resolvedTheme`. `title` falls back to
    // a static phrase because it can only carry one string.
    const a11y = (
      <>
        <span className="sr-only dark:hidden">切换到暗色模式</span>
        <span className="sr-only hidden dark:inline">切换到亮色模式</span>
      </>
    )
    const staticTitle = '切换深浅色模式'

    if (variant === 'floating') {
      // High-contrast FAB palette — see the matching block in
      // `@/ui/public/chrome/ScrollTopButton` for the rationale (default
      // `variant="light"` is too low-contrast over article content on
      // mobile, in both themes).
      return (
        <Button variant="fab" size="iconLg" shape="pill" onClick={toggle} title={staticTitle}>
          <IconButtonContent>
            <Moon size="1em" aria-hidden className={moonClass} />
            <Sun size="1em" aria-hidden className={sunClass} />
          </IconButtonContent>
          {a11y}
        </Button>
      )
    }
    // `mr-2` (= 8px) is the social-rail gap supplied by every rail
    // consumer that has a sibling to its right. Theme now sits between
    // the trailing social button and the Search trigger, so it owns
    // the gap; the search button at the end of the rail no longer
    // needs one.
    //
    // `max-lg:hidden` keeps the rail toggle off the mobile drawer —
    // the floating FAB pair in `BaseLayout` already provides one-tap
    // theme switching at `<lg`, and surfacing a second copy inside
    // the opened drawer would just be a duplicate control.
    return (
      <Button
        variant="dark"
        size="iconSm"
        shape="circle"
        className="mr-2 max-lg:hidden"
        onClick={toggle}
        title={staticTitle}
      >
        <IconButtonContent>
          <Sun size="1em" aria-hidden className={sunClass} />
          <Moon size="1em" aria-hidden className={moonClass} />
        </IconButtonContent>
        {a11y}
      </Button>
    )
  }

  const adminLabel = resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative text-foreground hover:text-primary focus-visible:text-primary"
      title={adminLabel}
    >
      <Sun data-icon className="transition-all dark:scale-0 dark:opacity-0" />
      <Moon data-icon className="absolute scale-0 opacity-0 transition-all dark:scale-100 dark:opacity-100" />
      <span className="sr-only">{adminLabel}</span>
    </Button>
  )
}
