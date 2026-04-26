import type { RefObject } from 'react'

import { useEffect, useLayoutEffect, useRef } from 'react'

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// On iOS Safari, focusing a form control whose `font-size` is below 16px makes
// the page zoom in automatically. The comment box uses smaller text on purpose
// (visual density), so instead of bumping the typography up we temporarily
// disable user scaling on the viewport meta tag while a control inside the
// container is focused, and restore the previous value on blur.
//
// Detection is restricted to iOS/iPadOS WebKit because other platforms do not
// exhibit the bug and we do not want to take away pinch-zoom unnecessarily.
export function useIosNoZoomOnFocus<T extends HTMLElement>(containerRef: RefObject<T | null>, enabled = true): void {
  const originalContentRef = useRef<string | null>(null)

  useBrowserLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (!enabled) return
    if (!isIos()) return

    const container = containerRef.current
    if (!container) return

    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return

    const isFormControl = (target: EventTarget | null): target is HTMLElement => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!isFormControl(event.target)) return
      if (originalContentRef.current !== null) return
      originalContentRef.current = meta.getAttribute('content')
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    }

    const onFocusOut = (event: FocusEvent) => {
      if (!isFormControl(event.target)) return
      // `relatedTarget` is the next focus owner: when it stays inside the
      // container we keep the lock; when it leaves we restore the viewport.
      const next = event.relatedTarget
      if (next instanceof HTMLElement && container.contains(next) && isFormControl(next)) {
        return
      }
      const original = originalContentRef.current
      if (original !== null) {
        meta.setAttribute('content', original)
      }
      originalContentRef.current = null
    }

    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('focusout', onFocusOut)
    return () => {
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
      // Defensive: if the component unmounts while a control is focused
      // (e.g. fast route change), make sure pinch-zoom comes back.
      if (originalContentRef.current !== null) {
        meta.setAttribute('content', originalContentRef.current)
        originalContentRef.current = null
      }
    }
  }, [containerRef, enabled])
}

function isIos(): boolean {
  const ua = window.navigator.userAgent
  // iPhone / iPod / classic iPad UA strings.
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ identifies as Macintosh; disambiguate via touch support.
  return ua.includes('Macintosh') && navigator.maxTouchPoints > 1
}
