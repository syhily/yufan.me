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
  /** Optional extra class added to the outer popup container — kept as
   *  a hook for callers that need a unique selector for outside-click
   *  detection (`document.querySelector('.qr-dialog-popup')`). */
  className?: string
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
export function Popup({ open, onClose, size = 'sm', className, children }: PopupProps) {
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
      className={cn(
        'fixed inset-0 z-1500 flex items-center justify-center overflow-x-hidden overflow-y-auto',
        entered ? 'visible opacity-100' : 'invisible opacity-0',
        className,
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
          className="fixed bottom-0 left-1/2 z-99 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 appearance-none items-center justify-center rounded-full border-0 bg-white p-0 shadow-popup-close transition-colors duration-150 ease-out hover:bg-popup-close-hover focus-visible:bg-popup-close-hover"
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
