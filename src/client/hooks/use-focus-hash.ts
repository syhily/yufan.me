import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

// Smooth-scroll to the URL hash on initial mount and whenever the hash
// changes. Also flashes a comment node when the hash targets one
// (`#user-comment-<id>`).
//
// The flash is driven through React state (FlashingCommentHashContext)
// instead of imperative `classList.add('active')` so the `active` class
// is part of the React render tree. This prevents hydration mismatches
// when React 19 streaming SSR places the comments chunk in the DOM
// before the full hydration pass completes.

const FLASH_DURATION_MS = 2100
const TARGET_WAIT_MS = 5000
const SCROLL_SETTLE_FALLBACK_MS = 300
const NO_SCROLL_THRESHOLD_PX = 4

const FlashingCommentHashContext = createContext<string | null>(null)

/** Returns the currently-flashing comment hash, or null when idle. */
export function useFlashingCommentHash(): string | null {
  return useContext(FlashingCommentHashContext)
}

export function FocusHashProvider({ children }: { children: React.ReactNode }) {
  const { hash } = useLocation()
  const [flashingHash, setFlashingHash] = useState<string | null>(null)
  const flashTimeoutRef = useRef<number | undefined>(undefined)

  const clearFlashTimeout = useCallback(() => {
    if (flashTimeoutRef.current !== undefined) {
      window.clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (!hash) {
      return
    }

    let observer: MutationObserver | undefined
    let targetWaitTimeoutId: number | undefined
    let scrollSettleTimeoutId: number | undefined
    let scrollEndHandler: (() => void) | undefined

    const clearScrollListeners = () => {
      if (scrollSettleTimeoutId !== undefined) {
        window.clearTimeout(scrollSettleTimeoutId)
        scrollSettleTimeoutId = undefined
      }
      if (scrollEndHandler !== undefined) {
        window.removeEventListener('scrollend', scrollEndHandler)
        scrollEndHandler = undefined
      }
    }

    const isCommentHash = hash.startsWith('#user-comment-')

    const fire = (): boolean => {
      const target = document.querySelector<HTMLElement>(hash)
      if (target === null) {
        return false
      }

      const rect = target.getBoundingClientRect()
      const targetTop = rect.top + window.scrollY
      const distance = Math.abs(targetTop - window.scrollY)

      const flash = () => {
        clearScrollListeners()
        if (isCommentHash) {
          clearFlashTimeout()
          // Reset the class first so the CSS animation restarts when
          // re-targeting the same comment after a round-trip away from
          // / back to the same hash.
          setFlashingHash(null)
          requestAnimationFrame(() => {
            setFlashingHash(hash)
            flashTimeoutRef.current = window.setTimeout(() => {
              setFlashingHash(null)
              flashTimeoutRef.current = undefined
            }, FLASH_DURATION_MS)
          })
        }
      }

      if (distance < NO_SCROLL_THRESHOLD_PX) {
        flash()
        return true
      }

      window.scroll({ top: targetTop, left: 0, behavior: 'smooth' })

      scrollEndHandler = flash
      window.addEventListener('scrollend', flash, { once: true })
      scrollSettleTimeoutId = window.setTimeout(flash, SCROLL_SETTLE_FALLBACK_MS)
      return true
    }

    if (!fire()) {
      observer = new MutationObserver(() => {
        if (fire()) {
          observer?.disconnect()
          observer = undefined
          if (targetWaitTimeoutId !== undefined) {
            window.clearTimeout(targetWaitTimeoutId)
            targetWaitTimeoutId = undefined
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      targetWaitTimeoutId = window.setTimeout(() => observer?.disconnect(), TARGET_WAIT_MS)
    }

    return () => {
      observer?.disconnect()
      if (targetWaitTimeoutId !== undefined) {
        window.clearTimeout(targetWaitTimeoutId)
      }
      clearScrollListeners()
    }
  }, [hash, clearFlashTimeout])

  return createElement(FlashingCommentHashContext.Provider, { value: flashingHash }, children)
}
