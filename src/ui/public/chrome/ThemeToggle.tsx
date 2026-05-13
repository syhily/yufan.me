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

export function ThemeToggle({ mode, variant = 'rail' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const label = resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'

  if (mode === 'public') {
    if (variant === 'floating') {
      // High-contrast FAB palette — see the matching block in
      // `@/ui/public/chrome/ScrollTopButton` for the rationale (default
      // `variant="light"` is too low-contrast over article content on
      // mobile, in both themes).
      return (
        <Button
          variant="light"
          size="iconLg"
          shape="pill"
          className="!bg-canvas !text-ink-strong shadow-tooltip hover:!bg-canvas hover:!text-ink-strong dark:!bg-slate-500 dark:!text-white dark:hover:!bg-slate-500 dark:hover:!text-white"
          onClick={toggle}
          title={label}
          aria-label={label}
        >
          <IconButtonContent>
            {resolvedTheme === 'dark' ? (
              <Sun size="1em" aria-hidden className="m-icon-inset" />
            ) : (
              <Moon size="1em" aria-hidden className="m-icon-inset" />
            )}
          </IconButtonContent>
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
        title={label}
        aria-label={label}
      >
        <IconButtonContent>
          {resolvedTheme === 'dark' ? (
            <Sun size="1em" aria-hidden className="m-icon-inset" />
          ) : (
            <Moon size="1em" aria-hidden className="m-icon-inset" />
          )}
        </IconButtonContent>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative text-foreground hover:text-primary focus-visible:text-primary"
      title={label}
    >
      <Sun data-icon className="transition-all dark:scale-0 dark:opacity-0" />
      <Moon data-icon className="absolute scale-0 opacity-0 transition-all dark:scale-100 dark:opacity-100" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}
