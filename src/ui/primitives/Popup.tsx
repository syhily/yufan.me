import type { ReactNode } from 'react'

import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/ui/lib/cn'

export type PopupSize = 'sm' | 'md' | 'lg'

export interface PopupProps {
  open: boolean
  onClose: () => void
  /** Body max-width preset. Defaults to `sm` (300px / fit-content). */
  size?: PopupSize
  /**
   * Optional unique identifier surfaced as `data-popup-id` on the
   * outer container so callers that need outside-click detection can
   * disambiguate sibling popups via a `[data-popup-id="…"]` selector
   * (the click happens on the document root, so a class hook on the
   * popup element is the standard way to scope the test). Without
   * this prop the popup still renders, just without a stable hook.
   */
  popupId?: string
  children: ReactNode
}

// Tailwind utility chains for the body's `max-width` ladder. `lg` is
// kept for API completeness but no consumer uses it today (only the QR
// dialog (`sm`) and header search (`md`) ship in the public bundle).
// The mobile fallback (`w-popup-mobile`) is identical across sizes
// because the responsive cap is a property of the viewport, not of
// the size preset. All three pixel values live in `tailwind.css`'s
// `--container-popup-*` block.
const BODY_SIZE_CLASS: Record<PopupSize, string> = {
  sm: 'max-w-popup-sm w-auto',
  md: 'max-w-popup-md',
  lg: 'max-w-popup-lg',
}

// Content card padding is symmetric (`1.75rem = p-7`) for md/lg, but
// the narrower 300px `sm` card opens its X axis to `2.5rem = px-10`
// so the inner content doesn't feel pinned to the chrome.
const CONTENT_SIZE_CLASS: Record<PopupSize, string> = {
  sm: 'py-7 px-10',
  md: 'p-7',
  lg: 'p-7',
}

// Floating "X" close button that sits half-overlapping the bottom of
// the popup card. Split into layout / box / colour / motion / state
// rows so the open hover / focus-visible flips read at a glance.
const popupCloseButtonClass = cn(
  'fixed bottom-0 left-1/2 z-99 flex items-center justify-center',
  '-translate-x-1/2 translate-y-1/2',
  'h-8 w-8 appearance-none rounded-full border-0 p-0',
  'bg-white shadow-popup-close',
  'transition-colors duration-150 ease-out',
  'hover:bg-popup-close-hover focus-visible:bg-popup-close-hover',
)

// Centered modal shell. We defer flipping on the "open" state by one
// frame so the CSS transition plays — without the rAF gate the
// browser would commit the open opacity/translate in the same paint
// as the initial mount and skip the transition entirely.
//
// Callers that need to focus a control inside the popup should call
// `ref.focus()` synchronously after `setOpen(true)` (typically wrapped
// in `flushSync` so the popup body has been mounted by then). Focus
// commits before the rAF below fires, so the input is interactive
// from the moment the user sees the dialog and the entrance
// animation still plays its full ~300ms cycle.
export function Popup({ open, onClose, size = 'sm', popupId, children }: PopupProps) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const raf = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      data-popup-id={popupId}
      className={cn(
        'fixed inset-0 z-1500 flex items-center justify-center overflow-x-hidden overflow-y-auto',
        entered ? 'visible opacity-100' : 'invisible opacity-0',
      )}
    >
      <div
        className={cn(
          'fixed inset-0 bg-black/30',
          entered ? 'pointer-events-auto visible opacity-100' : 'invisible opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-popup-mobile py-8 transition-all duration-300 ease-in-out md:w-full',
          entered ? 'pointer-events-auto visible translate-y-0 opacity-100' : 'invisible -translate-y-10 opacity-0',
          BODY_SIZE_CLASS[size],
        )}
      >
        <button
          type="button"
          aria-label="关闭"
          className={popupCloseButtonClass}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <XIcon size={22} aria-hidden className="inline-block align-middle text-gray-300" />
        </button>
        <div className={cn('relative rounded-lg bg-white text-ink-strong', CONTENT_SIZE_CLASS[size])}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
