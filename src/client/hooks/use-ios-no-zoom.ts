import { useEffect, useLayoutEffect, useRef } from 'react'

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// iOS Safari zooms the viewport in when the user focuses a form
// control whose CSS `font-size` is below 16px. Bumping every input
// to `font-size: 16px` would inflate the densities the project's
// design system relies on (admin form rows, comment composer, etc.),
// so we instead disable user-scaling on the viewport meta tag while
// any `INPUT` / `TEXTAREA` / `SELECT` on the page is focused and
// restore the previous value the moment focus leaves the form
// control.
//
// Project contract — call this hook ONCE at the top of the app
// (`src/root.tsx`'s `App` component). It listens on `document`
// through bubbling `focusin` / `focusout` events, so a single
// install covers every form control across public + admin + login
// + install flows. Individual form components MUST NOT call this
// themselves — duplicating the install would have two listeners
// race against the same `<meta>` rewrite and leak pinch-zoom in or
// out unpredictably. See `AGENTS.md` § "iOS auto-zoom contract".
//
// Detection is restricted to iOS / iPadOS WebKit because no other
// platform exhibits the bug; the no-op on Android / desktop means
// pinch-zoom on the rest of the page (e.g. zooming an article cover
// image) stays available.
export function useIosNoZoomOnFocus(): void {
  const originalContentRef = useRef<string | null>(null)

  useBrowserLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!isIos()) {
      return
    }

    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) {
      return
    }

    const isFormControl = (target: EventTarget | null): target is HTMLElement => {
      if (!(target instanceof HTMLElement)) {
        return false
      }
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!isFormControl(event.target)) {
        return
      }
      if (originalContentRef.current !== null) {
        return
      }
      originalContentRef.current = meta.getAttribute('content')
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    }

    const onFocusOut = (event: FocusEvent) => {
      if (!isFormControl(event.target)) {
        return
      }
      // `relatedTarget` is the next focus owner: keep the lock while
      // focus moves between form controls anywhere on the page —
      // restoring the meta tag mid-tab would let Safari re-zoom on
      // every keystroke.
      if (isFormControl(event.relatedTarget)) {
        return
      }
      const original = originalContentRef.current
      if (original !== null) {
        meta.setAttribute('content', original)
      }
      originalContentRef.current = null
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      // Defensive: if the app unmounts while a control is focused
      // (e.g. fast route change), make sure pinch-zoom comes back.
      if (originalContentRef.current !== null) {
        meta.setAttribute('content', originalContentRef.current)
        originalContentRef.current = null
      }
    }
  }, [])
}

function isIos(): boolean {
  const ua = window.navigator.userAgent
  // iPhone / iPod / classic iPad UA strings.
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true
  }
  // iPadOS 13+ identifies as Macintosh; disambiguate via touch support.
  return ua.includes('Macintosh') && navigator.maxTouchPoints > 1
}
